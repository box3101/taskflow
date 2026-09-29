"""Point-in-time leader records. No orders, notifications or network calls."""
import hashlib
import json
import math
import sqlite3
from contextlib import closing
from datetime import datetime, timezone, timedelta
from pathlib import Path

KST = timezone(timedelta(hours=9))

def finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)

def rank_signal(pool, quotes, code, theme, at):
    members = sorted(c for c, p in pool.items() if theme in p[2])
    peers, missing = [], []
    for c in members:
        q = quotes.get(c, {})
        value, stamp, exchange = q.get('turnoverWon'), q.get('turnoverSampleTs'), q.get('turnoverSourceTs')
        good = (finite(value) and value >= 0 and finite(stamp) and 0 <= at-stamp <= 20
                # Provider clock can lead local receipt by ~1s; allow <=3s skew only.
                and finite(exchange) and -3 <= at-exchange <= 90
                and datetime.fromtimestamp(exchange, KST).date() == datetime.fromtimestamp(at, KST).date())
        if not good: missing.append(c); continue
        peers.append(dict(code=c, name=pool[c][0], turnoverWon=value,
                          dayPct=q.get('dayPct'), sourceAt=datetime.fromtimestamp(exchange,KST).isoformat(),
                          sampledAt=datetime.fromtimestamp(stamp,KST).isoformat()))
    peers.sort(key=lambda p: (-p['turnoverWon'], p['code']))
    result = dict(status='unknown', rank=None, strengthRank=None, total=len(members), available=len(peers),
                  reason='비교 종목 시세 누락·지연', peers=peers, missing=missing, theme=theme,
                  basis='Naver 통합시장 누적 거래대금 · 원', observedAt=datetime.fromtimestamp(at,KST).isoformat())
    own = next((p for p in peers if p['code']==code),None)
    if len(members)<2 or code not in members:
        result['reason']='비교 테마 종목 부족'; return result
    if missing or own is None: return result
    if own['turnoverWon']<=0:
        result['reason']='거래대금 미발생'; return result
    rank=1+sum(p['turnoverWon']>own['turnoverWon'] for p in peers)
    if all(finite(p['dayPct']) for p in peers):
        result['strengthRank']=1+sum(p['dayPct']>own['dayPct'] for p in peers)
    result.update(rank=rank,status='pass' if rank==1 else 'excluded',
                  reason='테마 내 거래대금 1위' if rank==1 else '거래대금 1위 아님',
                  turnoverWon=own['turnoverWon'], tied=sum(p['turnoverWon']==own['turnoverWon'] for p in peers)>1)
    return result

class LeaderRecorder:
    def __init__(self, root, pool, at):
        self.date=datetime.fromtimestamp(at,KST).strftime('%Y-%m-%d')
        self.pool=json.loads(json.dumps(pool,ensure_ascii=False))
        directory=Path(root)/'reports/spike-leader';directory.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(directory/f'{self.date}.sqlite',timeout=5)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.executescript('CREATE TABLE IF NOT EXISTS universe (id INTEGER PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, at REAL NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS signals (key TEXT PRIMARY KEY, snapshot_id INTEGER NOT NULL, payload TEXT NOT NULL);')
        old=self.db.execute('SELECT payload FROM universe WHERE id=1').fetchone()
        if old: self.pool=json.loads(old[0])
        else:
            self.db.execute('INSERT INTO universe VALUES (1,?)',(json.dumps(self.pool,ensure_ascii=False),));self.db.commit()
        self.version=hashlib.sha256(json.dumps(self.pool,sort_keys=True).encode()).hexdigest()[:16]
        self.last=0

    def capture(self, quotes, at, code=None, theme=None, alert_time=None):
        if datetime.fromtimestamp(at,KST).strftime('%Y-%m-%d')!=self.date: raise ValueError('SESSION_DATE_CHANGED')
        if code is None and at-self.last<10: return
        # Only fields relevant to ranking; no account information.
        clean={c:{k:q.get(k) for k in ('turnoverWon','turnoverSampleTs','turnoverSourceTs','dayPct')} for c,q in quotes.items() if c in self.pool}
        with self.db:
            cur=self.db.execute('INSERT INTO snapshots(at,payload) VALUES (?,?)',(at,json.dumps(clean,allow_nan=False)))
            if code is not None:
                signal=rank_signal(self.pool,clean,code,theme,at)
                clock=alert_time or datetime.fromtimestamp(at,KST).strftime('%H:%M:%S')
                signal.update(date=self.date,time=clock,code=code,universeVersion=self.version)
                key=f'{self.date}|{clock}|{code}'
                self.db.execute('INSERT OR IGNORE INTO signals VALUES (?,?,?)',(key,cur.lastrowid,json.dumps(signal,ensure_ascii=False,allow_nan=False)))
        self.last=at

def read_records(root):
    records={}; latest=None
    for path in sorted((Path(root)/'reports/spike-leader').glob('????-??-??.sqlite')):
        with closing(sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,timeout=2)) as db:
            stamp=db.execute('SELECT MAX(at) FROM snapshots').fetchone()[0]
            if stamp is not None and (latest is None or stamp>latest):latest=stamp
            for (payload,) in db.execute('SELECT payload FROM signals ORDER BY key'):
                r=json.loads(payload);key=r['date']+r['time'][:5]+r['code']
                records.setdefault(key,r)
    return dict(records=records,lastCapturedAt=datetime.fromtimestamp(latest,KST).isoformat() if latest else None)
