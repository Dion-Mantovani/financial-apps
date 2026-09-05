// src/query/budgets.query.ts
import { supabase } from '../lib/supabase';
import { DUMMY_USER_ID } from '../lib/auth';
import type { BudgetPayload } from '../services/apiClient';

export async function fetchBudgetsByPeriod(period: string) {
  const { data, error } = await supabase
    .from('budgets')
    .select('*, categories(*)')
    .eq('user_id', DUMMY_USER_ID)
    .eq('period', period);

  if (error) throw error;
  return data;
}

export async function insertBudget(payload: BudgetPayload) {
  const { data, error } = await supabase
    .from('budgets')
    .insert([
      {
        user_id: DUMMY_USER_ID,
        category_id: payload.category_id,
        amount: payload.amount,
        period: payload.period,
      },
    ])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateBudgetById(payload: BudgetPayload) {
  const { data, error } = await supabase
    .from('budgets')
    .update({
      category_id: payload.category_id,
      amount: payload.amount,
    })
    .eq('id', payload.id)
    .eq('user_id', DUMMY_USER_ID)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteBudgetById(id: string) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID);

  if (error) throw error;
  return true;
}

export async function copyBudgetsFromPeriod(
  fromPeriod: string,
  toPeriod: string
) {
  const sourceBudgets = await fetchBudgetsByPeriod(fromPeriod);
  if (!sourceBudgets || sourceBudgets.length === 0) return [];

  const newBudgets = sourceBudgets.map((b) => ({
    user_id: DUMMY_USER_ID,
    category_id: b.category_id,
    amount: b.amount,
    period: toPeriod,
  }));

  const { data, error } = await supabase
    .from('budgets')
    .insert(newBudgets)
    .select();

  if (error) throw error;
  return data;
}
