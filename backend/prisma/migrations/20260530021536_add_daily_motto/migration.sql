-- CreateTable
CREATE TABLE "daily_mottos" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" VARCHAR(200) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_mottos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_mottos_user_id_date_key" ON "daily_mottos"("user_id", "date");

-- AddForeignKey
ALTER TABLE "daily_mottos" ADD CONSTRAINT "daily_mottos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
