import { sql } from './db';

// Function to run database migrations
export const runMigrations = async (): Promise<void> => {
  try {
    console.log('Running database migrations...');

    // Create businesses table
    await sql`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create revenue_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS revenue_entries (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create expense_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS expense_entries (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_revenue_entries_business_id ON revenue_entries(business_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_revenue_entries_date ON revenue_entries(date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expense_entries_business_id ON expense_entries(business_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expense_entries_date ON expense_entries(date)`;

    console.log('Database migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

// Types for TypeScript support
export interface Business {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RevenueEntry {
  id: number;
  business_id: number;
  amount: number;
  description?: string;
  category?: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseEntry {
  id: number;
  business_id: number;
  amount: number;
  description?: string;
  category?: string;
  date: string;
  created_at: string;
  updated_at: string;
}