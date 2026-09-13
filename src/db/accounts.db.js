import { initDB } from './indexeddb';

export const getAllAccountsLocal = async () => {
  const db = await initDB();
  return db.getAll('accounts');
};

export const saveAccountLocal = async (account) => {
  const db = await initDB();
  return db.put('accounts', account);
};

export const deleteAccountLocal = async (id) => {
  const db = await initDB();
  return db.delete('accounts', id);
};
