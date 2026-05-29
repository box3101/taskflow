-- CreateTable
CREATE TABLE "todo_files" (
    "id" SERIAL NOT NULL,
    "todo_id" INTEGER NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "mimetype" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "todo_files" ADD CONSTRAINT "todo_files_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
