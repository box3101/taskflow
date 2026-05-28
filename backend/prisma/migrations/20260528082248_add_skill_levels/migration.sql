-- CreateTable
CREATE TABLE "skill_levels" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📚',
    "content" TEXT NOT NULL,
    "challenge" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_progresses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "level_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "score" INTEGER,
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_levels_order_key" ON "skill_levels"("order");

-- CreateIndex
CREATE UNIQUE INDEX "skill_progresses_user_id_level_id_key" ON "skill_progresses"("user_id", "level_id");

-- AddForeignKey
ALTER TABLE "skill_progresses" ADD CONSTRAINT "skill_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_progresses" ADD CONSTRAINT "skill_progresses_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "skill_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
