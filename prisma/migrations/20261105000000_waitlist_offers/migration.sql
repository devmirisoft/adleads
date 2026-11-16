-- CreateEnum
CREATE TYPE "WaitlistOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "waitlist_alerted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "waitlist_offers" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "status" "WaitlistOfferStatus" NOT NULL DEFAULT 'PENDING',
    "offered_by" TEXT NOT NULL,
    "offered_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_offers_batch_id_status_idx" ON "waitlist_offers"("batch_id", "status");

-- CreateIndex
CREATE INDEX "waitlist_offers_lead_id_offered_at_idx" ON "waitlist_offers"("lead_id", "offered_at");

-- A lead holds at most one seat at a time, even if two batches are offered concurrently.
CREATE UNIQUE INDEX "waitlist_offers_one_pending_per_lead" ON "waitlist_offers"("lead_id") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "waitlist_offers" ADD CONSTRAINT "waitlist_offers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_offers" ADD CONSTRAINT "waitlist_offers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
