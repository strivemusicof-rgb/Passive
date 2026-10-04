-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_daily_claim" TEXT,
ADD COLUMN     "streak_day" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "mission_progress" (
    "user_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMP(3),

    CONSTRAINT "mission_progress_pkey" PRIMARY KEY ("user_id","period","key")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "user_id" UUID NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("user_id","row","col","day")
);

-- CreateIndex
CREATE INDEX "check_ins_user_id_day_idx" ON "check_ins"("user_id", "day");

-- AddForeignKey
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
