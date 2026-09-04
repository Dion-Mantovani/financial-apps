import { supabase } from '../lib/supabase';
import { DUMMY_USER_ID } from '../lib/auth';

export const fetchCategories = async () => {
  return await supabase
    .from('categories')
    .select('*')
    .eq('user_id', DUMMY_USER_ID)
    .order('name', { ascending: true });
};
