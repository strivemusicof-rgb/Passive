-- CreateTable
CREATE TABLE "leaderboard_prizes" (
    "month" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "user_id" UUID,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_prizes_pkey" PRIMARY KEY ("month","rank")
);
