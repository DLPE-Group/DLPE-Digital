-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "operator" TEXT,
    "author" TEXT,
    "when" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);
