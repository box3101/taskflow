-- CreateTable
CREATE TABLE "trade_logs" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "stock_name" VARCHAR(50) NOT NULL,
    "stock_code" VARCHAR(10) NOT NULL,
    "buy_price" INTEGER NOT NULL,
    "target_price" INTEGER,
    "stop_loss" INTEGER,
    "sell_price" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'holding',
    "buy_date" TEXT NOT NULL,
    "sell_date" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "trade_logs" ADD CONSTRAINT "trade_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
