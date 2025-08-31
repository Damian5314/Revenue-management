-- Revenue Management Database Schema

-- Table for businesses
CREATE TABLE IF NOT EXISTS businesses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for revenue entries
CREATE TABLE IF NOT EXISTS revenue_entries (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for expense entries (optional for comprehensive financial tracking)
CREATE TABLE IF NOT EXISTS expense_entries (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_revenue_entries_business_id ON revenue_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_revenue_entries_date ON revenue_entries(date);
CREATE INDEX IF NOT EXISTS idx_expense_entries_business_id ON expense_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_date ON expense_entries(date);