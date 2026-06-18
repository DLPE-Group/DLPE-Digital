-- Application role: LOGIN, NOT a superuser, NO BYPASSRLS, owns no tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'il_app') THEN
    CREATE ROLE il_app LOGIN PASSWORD 'il_app_pw';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO il_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO il_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO il_app;
-- Future tables created by the owner are auto-granted to il_app:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO il_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO il_app;
