import { fetchAccountsFromRemote } from './account.service';
import { fetchCategoriesFromRemote } from './category.service';
import { fetchTransactionsFromRemote } from './transaction.service';

import { saveAccountLocal } from '../db/accounts.db';
import { replaceAllCategoriesLocal } from '../db/categories.db';
import { saveTransactionLocal } from '../db/transactions.db';

export const initialDataSync = async () => {
  try {
    // Fetch serentak dari Supabase
    const [accounts, categories, transactions] = await Promise.all([
      fetchAccountsFromRemote(),
      fetchCategoriesFromRemote(),
      fetchTransactionsFromRemote(),
    ]);

    // Sinkronisasi kategori secara penuh:
    // IndexedDB akan dibuat sama dengan data Supabase
    if (categories) {
      await replaceAllCategoriesLocal(categories);
    }

    // Simpan account lokal
    if (accounts?.length) {
      await Promise.all(accounts.map((acc) => saveAccountLocal(acc)));
    }

    // Simpan transaksi lokal
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
