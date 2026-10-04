-- CreateTable
CREATE TABLE "ad_views" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "placement" TEXT NOT NULL,
    "ref" TEXT,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewarded_at" TIMESTAMP(3),
    "admob_tx_id" TEXT,

    CONSTRAINT "ad_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_views_admob_tx_id_key" ON "ad_views"("admob_tx_id");

-- CreateIndex
CREATE INDEX "ad_views_user_id_created_at_idx" ON "ad_views"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ad_views_placement_ref_key" ON "ad_views"("placement", "ref");

-- AddForeignKey
ALTER TABLE "ad_views" ADD CONSTRAINT "ad_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
