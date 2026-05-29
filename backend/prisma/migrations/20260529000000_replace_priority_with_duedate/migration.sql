-- AlterTable
ALTER TABLE "todos" DROP COLUMN "priority",
ADD COLUMN     "due_date" TIMESTAMP(3);
