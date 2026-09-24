ALTER TABLE "flow_predictions" ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'rag';
DROP INDEX "flow_predictions_user_id_snapshot_id_horizon_key";
CREATE UNIQUE INDEX "flow_predictions_user_id_snapshot_id_horizon_variant_key" ON "flow_predictions"("user_id", "snapshot_id", "horizon", "variant");
