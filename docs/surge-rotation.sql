-- Closed, fully observed trades only; blocked entries never become trade rows.
SELECT variant,
       count(*) FILTER (WHERE "exitAt" IS NOT NULL AND NOT excluded) AS completed,
       avg("netPct") FILTER (WHERE "exitAt" IS NOT NULL AND NOT excluded) AS mean_net_pct,
       100.0 * avg(CASE WHEN "netPct" > 0 THEN 1.0 ELSE 0.0 END)
         FILTER (WHERE "exitAt" IS NOT NULL AND NOT excluded) AS win_pct,
       avg(extract(epoch FROM ("entryAt" AT TIME ZONE 'Asia/Seoul')::time)) AS mean_entry_seconds_kst,
       count(*) FILTER (WHERE excluded) AS excluded
FROM surge_trades
GROUP BY variant ORDER BY variant;

SELECT variant, reason, count(*) AS trades,
       avg("netPct") AS mean_net_pct
FROM surge_trades
WHERE "exitAt" IS NOT NULL AND NOT excluded
GROUP BY variant, reason ORDER BY variant, reason;

-- Audit point-in-time additions; never substitute today's universe for an old date.
SELECT date, source, count(*), min("addedAt"), max("addedAt")
FROM surge_universe_days GROUP BY date, source ORDER BY date DESC, source;

SELECT kind, ok, error, count(*) FROM surge_notification_logs GROUP BY kind, ok, error;

-- The untouched legacy control retains its original JSON state and exclusions.
-- These rows are intentionally separate from the expanded-universe normalized trades.
WITH control AS (
  SELECT t FROM surge_days d,
    LATERAL jsonb_array_elements(COALESCE(d.payload->'legacy'->'trades', '[]'::jsonb)) t
)
SELECT 'LEGACY_CONTROL' AS variant,
       count(*) FILTER (WHERE t->>'status' = 'closed') AS completed,
       avg((t->>'netPct')::double precision) FILTER (WHERE t->>'status' = 'closed') AS mean_net_pct,
       100.0 * avg(CASE WHEN (t->>'netPct')::double precision > 0 THEN 1.0 ELSE 0.0 END)
         FILTER (WHERE t->>'status' = 'closed') AS win_pct,
       avg(extract(epoch FROM (to_timestamp((t->>'entryAt')::double precision / 1000)
         AT TIME ZONE 'Asia/Seoul')::time)) AS mean_entry_seconds_kst,
       count(*) FILTER (WHERE t->>'status' = 'excluded') AS excluded
FROM control;

SELECT 'LEGACY_CONTROL' AS variant, t->>'reason' AS reason, count(*) AS trades
FROM surge_days d,
  LATERAL jsonb_array_elements(COALESCE(d.payload->'legacy'->'trades', '[]'::jsonb)) t
WHERE t->>'status' = 'closed'
GROUP BY t->>'reason';
