/** Only our application objects; never touches Supabase Auth/Storage objects. */
export const SUPABASE_APPLICATION_ACCESS_SQL = `
DO $$
DECLARE target record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Supabase API roles are required for application access protection';
  END IF;

  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

  FOR target IN
    SELECT n.nspname, c.relname, c.oid
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND (
      (n.nspname = 'public' AND c.relname = ANY(ARRAY[
        'audit_entries', 'cart_items', 'carts', 'catalog_image_operations',
        'categories', 'idempotency_records', 'inventory_balances',
        'inventory_movements', 'invoice_lines', 'invoices', 'order_items',
        'orders', 'payments', 'product_images', 'product_tags', 'products',
        'role_assignments', 'sessions', 'store_logo_assets', 'store_profiles',
        'tags', 'users', 'wishlist_items', 'wishlists'
      ])) OR (n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations')
    )
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = target.oid) THEN
      RAISE EXCEPTION 'Review existing policies before protecting application tables';
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target.nspname, target.relname);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated, PUBLIC', target.nspname, target.relname);
  END LOOP;

  IF to_regclass('drizzle.__drizzle_migrations_id_seq') IS NOT NULL THEN
    REVOKE ALL ON SEQUENCE drizzle.__drizzle_migrations_id_seq FROM anon, authenticated, PUBLIC;
  END IF;
  FOR target IN
    SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN
      ('check_product_primary_image', 'lock_product_image_owner')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, PUBLIC', target.signature);
  END LOOP;
END $$;
`;

export async function protectSupabaseApplicationAccess(
  databaseUrl: string,
  executor: { query(text: string): Promise<unknown> },
): Promise<void> {
  const hostname = new URL(databaseUrl).hostname;
  if (!hostname.endsWith(".supabase.co") && !hostname.endsWith(".pooler.supabase.com")) return;
  await executor.query(SUPABASE_APPLICATION_ACCESS_SQL);
}
