import { supabase } from '../lib/supabase';
import { DUMMY_USER_ID } from '../lib/auth';

export const fetchTransactions = async () => {
  return await supabase
    .from('transactions')
    .select(
      `
      id,
      amount,
      type,
      notes,
      transaction_date,
      wallet_id,
      to_wallet_id,
      category_id,
      created_at,
      wallets!transactions_wallet_id_fkey ( id, name, type, color, icon, balance ),
      to_wallets:wallets!transactions_to_wallet_id_fkey ( id, name, type, color, icon, balance ),
      categories ( id, name, type, icon )
    `
    )
    .eq('user_id', DUMMY_USER_ID)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });
};

export const insertTransaction = async (payload: {
  wallet_id: string;
  to_wallet_id?: string | null;
  category_id: string | null;
  amount: number;
  type: string;
  notes: string;
  transaction_date: string;
}) => {
  return await supabase
    .from('transactions')
    .insert([{ ...payload, user_id: DUMMY_USER_ID }])
    .select();
};

export const updateTransaction = async (
  id: string,
  payload: {
    wallet_id: string;
    to_wallet_id?: string | null;
    category_id: string | null;
    amount: number;
    type: string;
    notes: string;
    transaction_date: string;
  }
) => {
  return await supabase
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID)
    .select();
};

export const deleteTransaction = async (id: string) => {
  return await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID);
};
