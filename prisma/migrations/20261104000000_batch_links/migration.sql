-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "paid_link" TEXT,
ADD COLUMN     "trial_link" TEXT;

-- Every join URL stored so far came from the fake Zoom adapter (the live one was never built).
-- From now on a stored link gets resent to real leads, so these must not survive.
UPDATE "enrollments" SET "zoom_join_url" = NULL WHERE "zoom_join_url" LIKE 'https://zoom.example/%';
