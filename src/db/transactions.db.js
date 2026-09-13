import { initDB } from './indexeddb';

export const getAllTransactionsLocal = async () => {
  const db = await initDB();
  return db.getAll('transactions');
};

export const saveTransactionLocal = async (transaction) => {
  const db = await initDB();
  return db.put('transactions', transaction);
};

export const deleteTransactionLocal = async (id) => {
  const db = await initDB();
  return db.delete('transactions', id);
};
