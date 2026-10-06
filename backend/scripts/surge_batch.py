"""Local/server-only pykrx batch. Never run Naver collection on GitHub Actions.

Outputs one JSON document; credentials and diagnostics must not go to stdout.
History is collected per date to permit durable checkpointing by the TS runner.
"""
import argparse
import contextlib
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request


def excluded_name(name):
    return bool(re.search(r"스팩|SPAC|(?:\d+)?우(?:B|C)?$|우선주|ETF|ETN", name, re.I))


def surge_rows(frame, date, min_value, min_rate):
    required = {"거래대금", "등락률"}
    if not required.issubset(frame.columns):
        raise ValueError("HISTORY_COLUMNS_MISSING")
    return [{"ticker": str(code), "date": date, "value": str(int(row["거래대금"])), "chgRate": float(row["등락률"])}
            for code, row in frame.iterrows()
            if float(row["거래대금"]) >= min_value and float(row["등락률"]) >= min_rate]


NAVER_API = "https://m.stock.naver.com/api/stocks/theme"


def naver_json(url, attempts=3):
    # finance.naver.com theme pages now redirect to a JS-rendered app; use its JSON API.
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception:
            if attempt == attempts:
                raise
            time.sleep(attempt * 2)


def paged(url, key, fetch, page_size=100, max_pages=50):
    rows = []
    for page in range(1, max_pages + 1):
        data = fetch(f"{url}?page={page}&pageSize={page_size}")
        items = data.get(key) or []
        rows.extend(items)
        total = data.get("totalCount")
        if not items or len(items) < page_size or (isinstance(total, int) and len(rows) >= total):
            break
    return rows


def theme_maps(date, fetch=naver_json, delay=None):
    """Returns (maps, failed theme count). One failing theme never discards the others."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        raise RuntimeError("NAVER_REQUIRES_LOCAL_OR_SERVER")
    delay = float(os.environ.get("SURGE_BATCH_DELAY_SECONDS", "1")) if delay is None else delay
    themes = {str(g["no"]): g["name"] for g in paged(NAVER_API, "groups", fetch) if g.get("no") and g.get("name")}
    if not themes:
        raise RuntimeError("NAVER_THEME_MAP_EMPTY")
    result, failed = [], 0
    for identifier, name in themes.items():
        try:
            for item in paged(f"{NAVER_API}/{identifier}", "stocks", fetch):
                code = str(item.get("itemCode") or "")
                if re.fullmatch(r"\d{6}", code):
                    result.append({"ticker": code, "themeId": f"NAVER:{identifier}", "themeName": name, "source": "NAVER", "validDate": date})
        except Exception:
            failed += 1
        time.sleep(delay)
    if not result:
        raise RuntimeError("NAVER_THEME_STOCKS_EMPTY")
    return list({(r["ticker"], r["themeId"]): r for r in result}.values()), failed


def recent_highs(frames):
    """Max daily high per ticker over the given completed-day frames (each indexed by ticker)."""
    highs = {}
    for frame in frames:
        if "고가" not in frame.columns:
            continue
        for code, value in frame["고가"].items():
            value = float(value)
            if value > 0 and value > highs.get(str(code), 0):
                highs[str(code)] = value
    return highs


def daily_highs(stock, previous, last_frame=None):
    days = int(os.environ.get("SURGE_HIGH_DAYS", "60"))
    start = (dt.datetime.strptime(previous, "%Y%m%d") - dt.timedelta(days=days * 2)).strftime("%Y%m%d")
    dates = [d.strftime("%Y%m%d") for d in stock.get_previous_business_days(fromdate=start, todate=previous)][-days:]
    frames = [stock.get_market_ohlcv(d, market="ALL") for d in dates if d != previous or last_frame is None]
    return recent_highs(frames + ([last_frame] if last_frame is not None else []))


def run(args):
    from pykrx import stock
    if args.mode == "replay":
        # Inputs for an after-hours replay of the given day: theme maps and prior N-day highs.
        previous = stock.get_nearest_business_day_in_a_week((dt.date.fromisoformat(args.date) - dt.timedelta(days=1)).strftime("%Y%m%d"))
        maps, failed = theme_maps(args.date)
        return {"date": args.date, "maps": maps, "failedThemes": failed, "highs": daily_highs(stock, previous)}
    if args.mode == "history":
        frame = stock.get_market_ohlcv(args.date.replace("-", ""), market="ALL")
        if frame.empty:
            raise RuntimeError("EMPTY_HISTORY_DATE")
        return {"date": args.date, "rows": surge_rows(frame, args.date,
            int(os.environ.get("SURGE_HISTORY_MIN_WON", "100000000000")), float(os.environ.get("SURGE_HISTORY_MIN_PCT", "10")))}
    previous = stock.get_nearest_business_day_in_a_week((dt.date.fromisoformat(args.date) - dt.timedelta(days=1)).strftime("%Y%m%d"))
    frame = stock.get_market_ohlcv(previous, market="ALL")
    if frame.empty or "거래대금" not in frame.columns:
        raise RuntimeError("UNIVERSE_DATA_MISSING")
    common = set(stock.get_market_ticker_list(previous, market="KOSPI")) | set(stock.get_market_ticker_list(previous, market="KOSDAQ"))
    securities = []
    for code, row in frame.sort_values("거래대금", ascending=False).iterrows():
        name = stock.get_market_ticker_name(code)
        if code in common and name and not excluded_name(name) and float(row["거래량"]) > 0:
            securities.append({"ticker": code, "name": name, "rank": len(securities) + 1})
    maps, warnings = [], []
    try:
        maps, failed = theme_maps(args.date)
        if failed:
            warnings.append(f"NAVER_THEME_PARTIAL:{failed}")
    except Exception as error:
        warnings.append(type(error).__name__ + ":NAVER_MAP_FAILED:" + str(error)[:80])
    for market in ("KOSPI", "KOSDAQ"):
        try:
            sectors = stock.get_market_sector_classifications(previous, market)
            for code, row in sectors.iterrows():
                sector = row.get("업종명")
                if sector:
                    maps.append({"ticker": str(code), "themeId": f"SECTOR:{market}:{sector}", "themeName": str(sector), "source": "SECTOR", "validDate": args.date})
        except Exception:
            warnings.append(f"SECTOR_MAP_FAILED:{market}")
    if not maps:
        raise RuntimeError("THEME_MAPPING_REQUIRED")
    # Daily-chart position for the checklist (near/at the N-day high). Failure leaves highs empty,
    # which blocks the high condition rather than guessing it.
    highs = {}
    try:
        wanted = {s["ticker"] for s in securities}
        highs = {k: v for k, v in daily_highs(stock, previous, frame).items() if k in wanted}
        if not highs:
            warnings.append("HIGH_DATA_EMPTY")
    except Exception as error:
        warnings.append(type(error).__name__ + ":HIGH_DATA_FAILED")
    return {"date": args.date, "previousDate": f"{previous[:4]}-{previous[4:6]}-{previous[6:]}", "securities": securities, "maps": maps, "warnings": warnings, "highs": highs}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["history", "prepare", "replay"])
    parser.add_argument("date")
    args = parser.parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        result = run(args)
    print(json.dumps(result, ensure_ascii=True))
