-- AlterTable
ALTER TABLE "plots" ADD COLUMN     "flag" TEXT,
ADD COLUMN     "skin" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_frame" TEXT,
ADD COLUMN     "name_color" TEXT;

-- CreateTable
CREATE TABLE "user_cosmetics" (
    "user_id" UUID NOT NULL,
    "item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cosmetics_pkey" PRIMARY KEY ("user_id","item_id")
);

-- AddForeignKey
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
