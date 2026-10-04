-- CreateTable
CREATE TABLE "economy_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "economy_config_pkey" PRIMARY KEY ("key")
);
