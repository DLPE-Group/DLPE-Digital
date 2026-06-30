-- StageConfig: make the stage set per-tenant.
-- The original unique was global ([track, stageId]); with RLS this made one
-- tenant's stage-config PUT (delete + recreate) collide with another tenant's
-- rows on the same (track, stageId) — a P2002 that crashed the API process.
-- Switch to a per-tenant composite unique so each tenant owns its own stages.

DROP INDEX "StageConfig_track_stageId_key";

CREATE UNIQUE INDEX "StageConfig_tenantId_track_stageId_key"
  ON "StageConfig"("tenantId", "track", "stageId");
