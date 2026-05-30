-- CreateTable
CREATE TABLE "stock_news" (
    "id" SERIAL NOT NULL,
    "stock_code" VARCHAR(10) NOT NULL,
    "stock_name" VARCHAR(50) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" VARCHAR(50) NOT NULL,
    "importance" VARCHAR(10) NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_news_cache_log" (
    "id" SERIAL NOT NULL,
    "stock_code" VARCHAR(10) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_news_cache_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_news_stock_code_published_at_idx" ON "stock_news"("stock_code", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_news_cache_log_stock_code_key" ON "stock_news_cache_log"("stock_code");
