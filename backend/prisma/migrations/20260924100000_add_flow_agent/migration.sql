ALTER TABLE "flow_reports" ADD COLUMN "rag_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "rag_error" TEXT, ADD COLUMN "rag_chunks" JSONB;

CREATE TABLE "flow_predictions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "snapshot_id" INTEGER NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "horizon" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "flow_predictions_user_id_snapshot_id_horizon_key" ON "flow_predictions"("user_id", "snapshot_id", "horizon");
CREATE INDEX "flow_predictions_user_id_date_idx" ON "flow_predictions"("user_id", "date");
