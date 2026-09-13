import { supabase } from '../lib/supabase';

export const fetchTransactionsFromRemote = async () => {
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) throw error;
  return data;
};

export const createTransactionRemote = async (txData) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(txData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTransactionRemote = async (id, txData) => {
  const { data, error } = await supabase
    .from('transactions')
    .update(txData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteTransactionRemote = async (id) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
  return true;
};
