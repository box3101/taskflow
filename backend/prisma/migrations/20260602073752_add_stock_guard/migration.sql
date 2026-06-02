-- AlterTable
ALTER TABLE "moods" ADD COLUMN     "memo" TEXT;

-- CreateTable
CREATE TABLE "stock_guard_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "windows" JSONB NOT NULL DEFAULT '[{"open":"09:05","close":"13:00"},{"open":"13:00","close":"15:35"},{"open":"15:35","close":"16:00"}]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_guard_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kakao_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kakao_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_guard_settings_user_id_key" ON "stock_guard_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kakao_tokens_user_id_key" ON "kakao_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "stock_guard_settings" ADD CONSTRAINT "stock_guard_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kakao_tokens" ADD CONSTRAINT "kakao_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
