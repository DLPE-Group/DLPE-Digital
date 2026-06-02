-- Phase 4: Card and Vehicle are replaced by the generic Entity model.
-- Drop the now-dormant tables (and their FKs/indexes).
ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_companyId_fkey";
ALTER TABLE "Vehicle" DROP CONSTRAINT IF EXISTS "Vehicle_companyId_fkey";
DROP TABLE IF EXISTS "Card";
DROP TABLE IF EXISTS "Vehicle";
