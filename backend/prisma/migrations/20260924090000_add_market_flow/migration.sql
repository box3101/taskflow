CREATE TABLE "flow_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "date" VARCHAR(10) NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "flow_snapshots_observed_at_key" ON "flow_snapshots"("observed_at");
CREATE INDEX "flow_snapshots_date_observed_at_idx" ON "flow_snapshots"("date", "observed_at");
CREATE TABLE "flow_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "content" BYTEA NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "flow_reports_user_id_date_idx" ON "flow_reports"("user_id", "date");
