import { db } from '../config/database.js';

export async function migrateAdminFks() {
  await db.transaction(async (client) => {
    // 1. audit_logs.admin_id
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_admin_id_fkey') THEN
            ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_admin_id_fkey;
          END IF;
          ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_admin_id_fkey 
            FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 2. books.reviewed_by & books.deleted_by
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'books') THEN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_reviewed_by_fkey') THEN
            ALTER TABLE books DROP CONSTRAINT books_reviewed_by_fkey;
          END IF;
          ALTER TABLE books ADD CONSTRAINT books_reviewed_by_fkey 
            FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL;

          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_deleted_by_fkey') THEN
            ALTER TABLE books DROP CONSTRAINT books_deleted_by_fkey;
          END IF;
          ALTER TABLE books ADD CONSTRAINT books_deleted_by_fkey 
            FOREIGN KEY (deleted_by) REFERENCES admin_users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 3. system_settings.updated_by
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_updated_by_fkey') THEN
            ALTER TABLE system_settings DROP CONSTRAINT system_settings_updated_by_fkey;
          END IF;
          ALTER TABLE system_settings ADD CONSTRAINT system_settings_updated_by_fkey 
            FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    console.log('✅ [MIGRATE] Foreign key constraints referencing admin_users updated to ON DELETE SET NULL successfully.');
  });
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('migrate_admin_fks.js') || 
  process.argv[1].replace(/\\/g, '/').endsWith('migrate_admin_fks.js')
);

if (isMain) {
  migrateAdminFks()
    .then(() => {
      console.log('Done migration.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
