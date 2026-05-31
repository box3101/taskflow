-- AlterTable
ALTER TABLE "stock_news" ADD COLUMN     "explain" TEXT,
ADD COLUMN     "sentiment" VARCHAR(10) NOT NULL DEFAULT 'neutral';
