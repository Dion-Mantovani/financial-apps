import { openDB } from 'idb';

const DB_NAME = 'financial_tracker_db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 1. Store Accounts
      if (!db.objectStoreNames.contains('accounts')) {
        const accountStore = db.createObjectStore('accounts', {
          keyPath: 'id',
        });
        accountStore.createIndex('status', 'status');
      }

      // 2. Store Categories
      if (!db.objectStoreNames.contains('categories')) {
        const categoryStore = db.createObjectStore('categories', {
          keyPath: 'id',
        });
        categoryStore.createIndex('type', 'type');
      }

      // 3. Store Transactions
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('account_id', 'account_id');
        txStore.createIndex('to_account_id', 'to_account_id');
        txStore.createIndex('transaction_date', 'transaction_date');
      }

      // 4. Store Sync Queue (Untuk menampung perubahan offline sebelum ke Supabase)
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    },
  });
};
