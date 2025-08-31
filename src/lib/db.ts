import { neon } from '@neondatabase/serverless';

// Load dotenv if we're in Node.js environment
if (typeof process !== 'undefined' && process.env) {
  try {
    require('dotenv').config();
  } catch {
    // dotenv not available, that's ok
  }
}

// Get database URL from environment variables
const getDatabaseUrl = (): string => {
  // Try both Node.js and Vite environment variables
  const url = process.env.DATABASE_URL || (import.meta as any).env?.VITE_DATABASE_URL;
  
  if (!url) {
    console.log('Environment variables:', { 
      DATABASE_URL: process.env.DATABASE_URL, 
      VITE_DATABASE_URL: (import.meta as any).env?.VITE_DATABASE_URL 
    });
    throw new Error('DATABASE_URL environment variable is not set. Make sure to set DATABASE_URL or VITE_DATABASE_URL in your .env file');
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