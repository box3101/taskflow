-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "description" TEXT,
ADD COLUMN     "due_at" TIMESTAMP(3),
ADD COLUMN     "requested_at" TIMESTAMP(3),
ADD COLUMN     "urgency" TEXT NOT NULL DEFAULT 'normal';

-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'none';
