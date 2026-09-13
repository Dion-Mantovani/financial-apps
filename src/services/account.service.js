import { supabase } from '../lib/supabase';

export const fetchAccountsFromRemote = async () => {
  const { data, error } = await supabase.from('accounts').select('*');
  if (error) throw error;
  return data;
};

export const createAccountRemote = async (accountData) => {
  const { data, error } = await supabase
    .from('accounts')
    .insert(accountData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAccountRemote = async (id, accountData) => {
  const { data, error } = await supabase
    .from('accounts')
    .update(accountData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteAccountRemote = async (id) => {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
  return true;
};
