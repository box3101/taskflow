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
from html.parser import HTMLParser


def excluded_name(name):
    return bool(re.search(r"스팩|SPAC|(?:\d+)?우(?:B|C)?$|우선주|ETF|ETN", name, re.I))


def surge_rows(frame, date, min_value, min_rate):
    required = {"거래대금", "등락률"}
    if not required.issubset(frame.columns):
        raise ValueError("HISTORY_COLUMNS_MISSING")
    return [{"ticker": str(code), "date": date, "value": str(int(row["거래대금"])), "chgRate": float(row["등락률"])}
            for code, row in frame.iterrows()
            if float(row["거래대금"]) >= min_value and float(row["등락률"]) >= min_rate]


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.href, self.text = [], None, []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.text = []

    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            self.links.append((self.href, "".join(self.text).strip()))
            self.href = None


def naver_links(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=15) as response:
        text = response.read().decode("euc-kr", errors="replace")
    parser = Links()
    parser.feed(text)
    return parser.links


def theme_maps(date):
    if os.environ.get("GITHUB_ACTIONS") == "true":
        raise RuntimeError("NAVER_REQUIRES_LOCAL_OR_SERVER")
    delay = float(os.environ.get("SURGE_BATCH_DELAY_SECONDS", "1"))
    themes = {}
    max_pages = int(os.environ.get("SURGE_NAVER_THEME_PAGES", "20"))
    for page in range(1, max_pages + 1):
        links = naver_links(f"https://finance.naver.com/sise/theme.naver?page={page}")
        before = len(themes)
        for href, name in links:
            match = re.search(r"sise_group_detail.naver\?type=theme&no=(\d+)", href)
            if match and name:
                themes[match.group(1)] = name
        if len(themes) == before:
            break
        time.sleep(delay)
    if not themes:
        raise RuntimeError("NAVER_THEME_MAP_EMPTY")
    result = []
    for identifier, name in themes.items():
        for href, _ in naver_links(f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={identifier}"):
            match = re.search(r"/item/main.naver\?code=(\d{6})", href)
            if match:
                result.append({"ticker": match.group(1), "themeId": f"NAVER:{identifier}", "themeName": name, "source": "NAVER", "validDate": date})
        time.sleep(delay)
    return list({(r["ticker"], r["themeId"]): r for r in result}.values())


def run(args):
    from pykrx import stock
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
        maps = theme_maps(args.date)
    except Exception as error:
        warnings.append(type(error).__name__ + ":NAVER_MAP_FAILED")
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
    return {"date": args.date, "previousDate": f"{previous[:4]}-{previous[4:6]}-{previous[6:]}", "securities": securities, "maps": maps, "warnings": warnings}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["history", "prepare"])
    parser.add_argument("date")
    args = parser.parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        result = run(args)
    print(json.dumps(result, ensure_ascii=True))
