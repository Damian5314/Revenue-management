import { neon } from '@neondatabase/serverless';

// Get database URL from environment variables
const getDatabaseUrl = (): string => {
  const url = (import.meta as any).env?.VITE_DATABASE_URL;
  
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  return url;
};

// Create database connection
export const sql = neon(getDatabaseUrl());

// Helper function to test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await sql`SELECT 1 as test`;
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Export types for TypeScript support
export type DatabaseResult = any[];
export type DatabaseRow = Record<string, any>;