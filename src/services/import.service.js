import { upsertRecord, addSyncQueue } from '../data/indexeddb.js';
import { accountStore } from '../stores/account.store.js';
import { categoryStore } from '../stores/category.store.js';
import { transactionStore } from '../stores/transaction.store.js';
import { appStore } from '../stores/app.store.js';

export async function importLegacyData(payload) {
  if (
    !payload ||
    !payload.accounts ||
    !payload.categories ||
    !payload.transactions
  ) {
    throw new Error(
      'Payload tidak valid: Struktur accounts, categories, atau transactions hilang.'
    );
  }

  try {
    // Deep clone awal dari payload mentah
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    const { accounts = [], categories = [], transactions = [] } = cleanPayload;

    // 1. Import Accounts
    for (const account of accounts) {
      await upsertRecord('accounts', account);
      await addSyncQueue({
        table: 'accounts',
        record_id: account.id,
        operation: 'create',
      });
    }

    // 2. Import Categories
    for (const category of categories) {
      await upsertRecord('categories', category);
      await addSyncQueue({
        table: 'categories',
        record_id: category.id,
        operation: 'create',
      });
    }

    // 3. Import Transactions
    for (const transaction of transactions) {
      await upsertRecord('transactions', transaction);
      await addSyncQueue({
        table: 'transactions',
        record_id: transaction.id,
        operation: 'create',
      });
    }

    // 5. Refresh State UI Alpine (Penting!)
    await accountStore.loadAccounts();
    await categoryStore.loadCategories();
    await transactionStore.loadTransactions();
    await appStore.updatePendingCount();

    return true;
  } catch (error) {
    console.error('[Import Service] Gagal mengeksekusi bulk import:', error);
    throw error;
  }
}
