-- StageConfig.track: `Track` enum -> TEXT (bare operational track key).
-- Lets custom (non-builtin) tracks carry their own stage set, and unifies the
-- operational track key on bare strings end-to-end (Entity.trackId, /cards,
-- /stages, allowedTracks). Existing enum values ('SALES' …) are lowercased to
-- the bare key ('sales' …). Indexes/uniques are preserved automatically by the
-- column type change. The `Track` enum type is intentionally left in place
-- (still referenced by the generated Prisma client type; no column uses it).
ALTER TABLE "StageConfig"
  ALTER COLUMN "track" TYPE TEXT USING lower("track"::text);
