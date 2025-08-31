#!/usr/bin/env tsx

import { runMigrations } from '../src/lib/migrations';

async function migrate() {
  try {
    console.log('🚀 Starting database migrations...');
    await runMigrations();
    console.log('✅ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();