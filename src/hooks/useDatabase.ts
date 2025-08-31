import { useState, useEffect } from 'react';
import { businessOperations, subscriptionOperations, converters } from '../lib/database-operations';
import { Business } from '../lib/migrations';

export function useDatabase() {
  const [companies, setCompanies] = useState<Business[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from database
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading data from database...');
      
      const [businessData, revenueData] = await Promise.all([
        businessOperations.getAll(),
        subscriptionOperations.getAll()
      ]);
      
      console.log('✅ Data loaded:', { businesses: businessData.length, revenues: revenueData.length });
      
      setCompanies(businessData);
      setSubs(revenueData.map(converters.revenueEntryToSubscription));
    } catch (err) {
      console.error('❌ Database error:', err);
      setError('Database fout: ' + (err as Error).message);
      
      // Fallback to empty data instead of crashing
      setCompanies([]);
      setSubs([]);
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Company operations
  const addCompany = async (name: string, description?: string) => {
    try {
      const newCompany = await businessOperations.create(name, description);
      setCompanies(prev => [newCompany, ...prev]);
      return newCompany;
    } catch (err) {
      setError('Fout bij toevoegen bedrijf: ' + (err as Error).message);
      throw err;
    }
  };

  const updateCompany = async (id: number, updates: Partial<Pick<Business, 'name' | 'description'>>) => {
    try {
      const updated = await businessOperations.update(id, updates);
      setCompanies(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    } catch (err) {
      setError('Fout bij updaten bedrijf: ' + (err as Error).message);
      throw err;
    }
  };

  const deleteCompany = async (id: number) => {
    try {
      await businessOperations.delete(id);
      setCompanies(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError('Fout bij verwijderen bedrijf: ' + (err as Error).message);
      throw err;
    }
  };

  // Subscription operations
  const addSubscription = async (subData: any) => {
    try {
      const revenueData = converters.subscriptionToRevenueEntry(subData);
      const newEntry = await subscriptionOperations.create(revenueData);
      const newSub = converters.revenueEntryToSubscription(newEntry);
      setSubs(prev => [newSub, ...prev]);
      return newSub;
    } catch (err) {
      setError('Fout bij toevoegen item: ' + (err as Error).message);
      throw err;
    }
  };

  const updateSubscription = async (id: string, updates: any) => {
    try {
      const numId = parseInt(id);
      const revenueUpdates = converters.subscriptionToRevenueEntry({...updates, id});
      const updated = await subscriptionOperations.update(numId, revenueUpdates);
      const updatedSub = converters.revenueEntryToSubscription(updated);
      setSubs(prev => prev.map(s => s.id === id ? updatedSub : s));
      return updatedSub;
    } catch (err) {
      setError('Fout bij updaten item: ' + (err as Error).message);
      throw err;
    }
  };

  const deleteSubscription = async (id: string) => {
    try {
      const numId = parseInt(id);
      await subscriptionOperations.delete(numId);
      setSubs(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError('Fout bij verwijderen item: ' + (err as Error).message);
      throw err;
    }
  };

  return {
    // Data
    companies: companies.map(c => ({ id: c.id.toString(), name: c.name })),
    subs,
    loading,
    error,
    
    // Operations
    addCompany,
    updateCompany,
    deleteCompany,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    
    // Refresh
    refresh: loadData
  };
}