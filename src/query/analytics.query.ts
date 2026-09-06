// src/queries/analytics.query.ts
import { supabase } from '../lib/supabase';
import { DUMMY_USER_ID } from '../lib/auth';

export async function fetchTransactionsForAnalytics() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(*), wallets:wallet_id(*)')
    .eq('user_id', DUMMY_USER_ID)
    .order('transaction_date', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchBudgetsForAnalytics(period: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*, categories(*)')
    .eq('user_id', DUMMY_USER_ID)
    .eq('period', period);

  if (error) throw error;
  return data || [];
}
