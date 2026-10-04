-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'sold', 'cancelled');

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "seller_id" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "buyer_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favourites" (
    "user_id" UUID NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("user_id","row","col")
);

-- CreateIndex
CREATE INDEX "listings_status_created_at_idx" ON "listings"("status", "created_at");

-- CreateIndex
CREATE INDEX "listings_seller_id_idx" ON "listings"("seller_id");

-- CreateIndex
CREATE INDEX "listings_buyer_id_closed_at_idx" ON "listings"("buyer_id", "closed_at");

-- CreateIndex
CREATE INDEX "listings_row_col_idx" ON "listings"("row", "col");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_row_col_fkey" FOREIGN KEY ("row", "col") REFERENCES "plots"("row", "col") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One active listing per plot.
CREATE UNIQUE INDEX "listings_one_active_per_plot" ON "listings"("row", "col") WHERE "status" = 'active';
-- Prices are positive.
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_positive" CHECK ("price" > 0);
