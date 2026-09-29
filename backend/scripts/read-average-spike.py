"""Read only the original Average spike dashboard inputs. Never start a detector or orders."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root / 'scripts'))
import spike_dashboard
from spike_leader import read_records

def read(relative, default=None):
    path = root / relative
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))

today = datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
auto = read(f'reports/spike-auto/{today}.json')
codes = {p['code'] for p in (auto or {}).get('positions', [])}
fills = {k: {field: v.get(field) for field in ['dateISO', 'code', 'side', 'time', 'filledQty', 'avgPrice']}
         for k, v in read('reports/trade-log.json', {}).items()
         if v and v.get('dateISO') == today and v.get('code') in codes}
themes = {s['code']: t['key'] for t in read('themes.json', {}).get('themes', []) for s in t.get('stocks', [])}
data = dict(spike=spike_dashboard.snapshot(root), market=read('reports/spike-market-history.json'),
            live=read('reports/spike-market-live.json'), auto=auto, fills=fills, themes=themes,
            leader=read_records(root), loadedAt=datetime.now(timezone.utc).isoformat())
print(json.dumps(data, ensure_ascii=True, allow_nan=False))
