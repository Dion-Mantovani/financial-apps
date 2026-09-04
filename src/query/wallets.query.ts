import { supabase } from '../lib/supabase';
import { DUMMY_USER_ID } from '../lib/auth';

export const fetchWallets = async () => {
  return await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', DUMMY_USER_ID)
    .order('created_at', { ascending: true });
};

export const fetchWalletById = async (id: string) => {
  return await supabase
    .from('wallets')
    .select('*')
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID)
    .single();
};

export const insertWallet = async (payload: {
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
}) => {
  return await supabase
    .from('wallets')
    .insert([{ ...payload, user_id: DUMMY_USER_ID }])
    .select();
};

export const updateWallet = async (
  id: string,
  payload: {
    name: string;
    type: string;
    balance: number;
    color: string;
    icon: string;
  }
) => {
  return await supabase
    .from('wallets')
    .update(payload)
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID)
    .select();
};

export const deleteWallet = async (id: string) => {
  return await supabase
    .from('wallets')
    .delete()
    .eq('id', id)
    .eq('user_id', DUMMY_USER_ID);
};
