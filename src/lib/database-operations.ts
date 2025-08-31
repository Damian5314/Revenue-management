import { sql } from './db';
import { Business, RevenueEntry } from './migrations';

// Business operations
export const businessOperations = {
  async getAll(): Promise<Business[]> {
    return await sql`SELECT * FROM businesses ORDER BY created_at DESC`;
  },

  async create(name: string, description?: string): Promise<Business> {
    const [business] = await sql`
      INSERT INTO businesses (name, description)
      VALUES (${name}, ${description || null})
      RETURNING *
    `;
    return business;
  },

  async update(id: number, updates: Partial<Pick<Business, 'name' | 'description'>>): Promise<Business> {
    const [business] = await sql`
      UPDATE businesses 
      SET name = COALESCE(${updates.name}, name),
          description = COALESCE(${updates.description}, description),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return business;
  },

  async delete(id: number): Promise<void> {
    await sql`DELETE FROM businesses WHERE id = ${id}`;
  }
};

// Subscription/Revenue operations
export const subscriptionOperations = {
  async getAll(): Promise<RevenueEntry[]> {
    return await sql`SELECT * FROM revenue_entries ORDER BY created_at DESC`;
  },

  async create(data: {
    business_id?: number | null;
    amount: number;
    description?: string;
    category?: string;
    date: string;
  }): Promise<RevenueEntry> {
    const [entry] = await sql`
      INSERT INTO revenue_entries (business_id, amount, description, category, date)
      VALUES (${data.business_id || null}, ${data.amount}, ${data.description || null}, ${data.category || null}, ${data.date})
      RETURNING *
    `;
    return entry;
  },

  async update(id: number, updates: Partial<Omit<RevenueEntry, 'id' | 'created_at' | 'updated_at'>>): Promise<RevenueEntry> {
    const [entry] = await sql`
      UPDATE revenue_entries 
      SET business_id = COALESCE(${updates.business_id}, business_id),
          amount = COALESCE(${updates.amount}, amount),
          description = COALESCE(${updates.description}, description),
          category = COALESCE(${updates.category}, category),
          date = COALESCE(${updates.date}, date),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    return entry;
  },

  async delete(id: number): Promise<void> {
    await sql`DELETE FROM revenue_entries WHERE id = ${id}`;
  },

  async getByBusinessId(businessId: number): Promise<RevenueEntry[]> {
    return await sql`SELECT * FROM revenue_entries WHERE business_id = ${businessId} ORDER BY date DESC`;
  },

  async getByDateRange(startDate: string, endDate: string): Promise<RevenueEntry[]> {
    return await sql`
      SELECT * FROM revenue_entries 
      WHERE date >= ${startDate} AND date <= ${endDate}
      ORDER BY date ASC
    `;
  }
};

// Helper functions to convert between app types and database types
export const converters = {
  // Convert app Subscription to database RevenueEntry
  subscriptionToRevenueEntry(sub: any): {
    business_id?: number | null;
    amount: number;
    description: string;
    category: string;
    date: string;
  } {
    return {
      business_id: sub.companyId ? parseInt(sub.companyId) : null,
      amount: sub.price,
      description: `${sub.customer} - ${sub.planName} ${sub.notes ? '(' + sub.notes + ')' : ''}`.trim(),
      category: sub.billingType,
      date: sub.startDate
    };
  },

  // Convert database RevenueEntry to app Subscription format
  revenueEntryToSubscription(entry: RevenueEntry): any {
    const [customer, planName] = entry.description?.split(' - ') || ['', ''];
    return {
      id: entry.id.toString(),
      companyId: entry.business_id?.toString() || null,
      productId: null,
      customer: customer || 'Onbekend',
      planName: planName || 'Onbekend',
      price: entry.amount,
      billingType: entry.category || 'onetime',
      cadence: 'monthly',
      startDate: entry.date,
      cancelDate: null,
      notes: '',
      variableAmounts: {}
    };
  }
};