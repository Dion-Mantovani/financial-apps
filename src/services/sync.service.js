import { fetchAccountsFromRemote } from './account.service';
import { fetchCategoriesFromRemote } from './category.service';
import { fetchTransactionsFromRemote } from './transaction.service';

import { saveAccountLocal } from '../db/accounts.db';
import { bulkSaveCategoriesLocal } from '../db/categories.db';
import { saveTransactionLocal } from '../db/transactions.db';

export const initialDataSync = async () => {
  try {
    // Fetch serentak dari Supabase
    const [accounts, categories, transactions] = await Promise.all([
      fetchAccountsFromRemote(),
      fetchCategoriesFromRemote(),
      fetchTransactionsFromRemote(),
    ]);

    // Simpan ke IndexedDB lokal
    if (categories?.length) await bulkSaveCategoriesLocal(categories);
    if (accounts?.length) {
      await Promise.all(accounts.map((acc) => saveAccountLocal(acc)));
    }
    if (transactions?.length) {
      await Promise.all(transactions.map((tx) => saveTransactionLocal(tx)));
    }

    console.log('✅ Sync sukses: Remote data tersimpan ke IndexedDB');
  } catch (err) {
    console.warn(
      '⚠️ Gagal sync remote data (Mungkin offline/jaringan lambat):',
      err.message
    );
  }
};
