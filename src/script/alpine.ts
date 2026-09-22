// src/scripts/alpine.ts
import Alpine from 'alpinejs';
import collapse from '@alpinejs/collapse';
import { appStore } from '../stores/app.store.js';
import { transactionStore } from '../stores/transaction.store.js';
import { accountStore } from '../stores/account.store.js';
import { categoryStore } from '../stores/category.store.js';

/**
 * Mendaftarkan plugin, meroketkan reaktivitas store global,
 * dan menginisialisasi Alpine.js pada startup aplikasi.
 *
 * @param {typeof Alpine} AlpineInstance - Instance Alpine.js yang diinjeksi saat bootstrapping
 * @returns {Promise<void>}
 */
export default async (AlpineInstance: typeof Alpine): Promise<void> => {
  // 1. Registrasi Plugin Alpine.js
  AlpineInstance.plugin(collapse);

  // 2. Buat appStore menjadi Reactive agar UI merespons perubahan pendingCount & status sync secara instan
  const reactiveAppStore = AlpineInstance.reactive(appStore);

  // 3. Daftarkan seluruh Store ke Global State Alpine
  AlpineInstance.store('app', reactiveAppStore);
  AlpineInstance.store('transaction', transactionStore);
  AlpineInstance.store('account', accountStore);
  AlpineInstance.store('category', categoryStore);

  // 4. Inisialisasi Database Lokal & Listener Auto-Sync
  await reactiveAppStore.initApp();
};
