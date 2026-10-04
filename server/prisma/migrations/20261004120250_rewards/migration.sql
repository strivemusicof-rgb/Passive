-- CreateEnum
CREATE TYPE "CashoutStatus" AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- AlterEnum
ALTER TYPE "Currency" ADD VALUE 'points';

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cashout_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "eur_cents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "CashoutStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "cashout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashout_requests_status_created_at_idx" ON "cashout_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "cashout_requests_user_id_idx" ON "cashout_requests"("user_id");

-- AddForeignKey
ALTER TABLE "cashout_requests" ADD CONSTRAINT "cashout_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_points_non_negative" CHECK ("points" >= 0);
-- At most one open request per player.
CREATE UNIQUE INDEX "cashout_one_pending_per_user" ON "cashout_requests" ("user_id") WHERE "status" = 'pending';
