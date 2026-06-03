/*
  Warnings:

  - You are about to drop the `skill_levels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `skill_progresses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "skill_progresses" DROP CONSTRAINT "skill_progresses_level_id_fkey";

-- DropForeignKey
ALTER TABLE "skill_progresses" DROP CONSTRAINT "skill_progresses_user_id_fkey";

-- DropTable
DROP TABLE "skill_levels";

-- DropTable
DROP TABLE "skill_progresses";
