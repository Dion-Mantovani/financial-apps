import * as categoryQuery from '../query/categories.query';

export const getCategories = async () => {
  const { data, error } = await categoryQuery.fetchCategories();
  if (error) throw new Error(error.message);
  return data;
};
