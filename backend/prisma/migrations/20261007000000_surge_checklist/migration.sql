-- Prior N-day daily high (default 60) for the checklist "near the high" condition.
ALTER TABLE "surge_universe_days" ADD COLUMN "high60" DOUBLE PRECISION;
