-- Seats are unlimited: a batch is OPEN or CLOSED, and seats_taken only counts its students.

-- AlterEnum
BEGIN;
UPDATE "batches" SET "status" = 'OPEN' WHERE "status" = 'FULL';
CREATE TYPE "BatchStatus_new" AS ENUM ('OPEN', 'CLOSED');
ALTER TABLE "batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "batches" ALTER COLUMN "status" TYPE "BatchStatus_new" USING ("status"::text::"BatchStatus_new");
ALTER TYPE "BatchStatus" RENAME TO "BatchStatus_old";
ALTER TYPE "BatchStatus_new" RENAME TO "BatchStatus";
DROP TYPE "BatchStatus_old";
ALTER TABLE "batches" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "capacity";
