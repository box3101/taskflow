CREATE TABLE "flow_auto_runs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" VARCHAR(10) NOT NULL,
  "slot" INTEGER NOT NULL,
  "snapshot_id" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "reserved_calls" INTEGER NOT NULL,
  "message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "flow_auto_runs_user_id_date_slot_key" UNIQUE ("user_id", "date", "slot")
);
