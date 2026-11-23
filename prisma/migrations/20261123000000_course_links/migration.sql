-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "link_interval_days" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "links" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "last_link_day" INTEGER NOT NULL DEFAULT 0;
