-- CreateTable
CREATE TABLE "TrackDef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "builtin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TrackDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageDef" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sla" INTEGER NOT NULL DEFAULT 0,
    "lock" TEXT,
    "cta" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StageDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "trackId" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "builtin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EntityType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldDef" (
    "id" TEXT NOT NULL,
    "entityTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "dataKind" TEXT NOT NULL DEFAULT 'text',
    "order" INTEGER NOT NULL DEFAULT 0,
    "builtin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "entityTypeId" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "value" INTEGER,
    "owner" TEXT,
    "status" TEXT,
    "sub" TEXT,
    "sources" TEXT[],
    "fields" JSONB,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "trackId" TEXT,
    "stageId" TEXT,
    "stageName" TEXT,
    "days" INTEGER NOT NULL DEFAULT 0,
    "daysLabel" TEXT,
    "cta" TEXT,
    "awaitingSign" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackDef_key_key" ON "TrackDef"("key");

-- CreateIndex
CREATE INDEX "StageDef_trackId_order_idx" ON "StageDef"("trackId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StageDef_trackId_stageId_key" ON "StageDef"("trackId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_key_key" ON "EntityType"("key");

-- CreateIndex
CREATE INDEX "FieldDef_entityTypeId_order_idx" ON "FieldDef"("entityTypeId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDef_entityTypeId_key_key" ON "FieldDef"("entityTypeId", "key");

-- CreateIndex
CREATE INDEX "Entity_tenantId_companyId_entityTypeId_trackId_stageId_idx" ON "Entity"("tenantId", "companyId", "entityTypeId", "trackId", "stageId");

-- CreateIndex
CREATE INDEX "Entity_tenantId_trackId_stageId_status_idx" ON "Entity"("tenantId", "trackId", "stageId", "status");

-- AddForeignKey
ALTER TABLE "StageDef" ADD CONSTRAINT "StageDef_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "TrackDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityType" ADD CONSTRAINT "EntityType_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "TrackDef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDef" ADD CONSTRAINT "FieldDef_entityTypeId_fkey" FOREIGN KEY ("entityTypeId") REFERENCES "EntityType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_entityTypeId_fkey" FOREIGN KEY ("entityTypeId") REFERENCES "EntityType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
