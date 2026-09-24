CREATE TABLE "flow_expert_reviews" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "date" VARCHAR(10) NOT NULL,
  "task" TEXT NOT NULL,
  "snapshot_id" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_expert_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "flow_expert_reviews_user_date_task_snapshot_provider_key" ON "flow_expert_reviews"("user_id", "date", "task", "snapshot_id", "provider");
CREATE INDEX "flow_expert_reviews_user_id_date_idx" ON "flow_expert_reviews"("user_id", "date");
