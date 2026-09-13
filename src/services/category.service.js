import { supabase } from '../lib/supabase';

export const fetchCategoriesFromRemote = async () => {
  const { data, error } = await supabase.from('categories').select('*');
  if (error) throw error;
  return data;
};

export const createCategoryRemote = async (categoryData) => {
  const { data, error } = await supabase
    .from('categories')
    .insert(categoryData)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateCategoryRemote = async (id, categoryData) => {
  const { data, error } = await supabase
    .from('categories')
    .update(categoryData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteCategoryRemote = async (id) => {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
  return true;
};
