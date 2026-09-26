// src/stores/account.store.js
import { readonly } from 'astro:schema';
import {
  getAllRecords,
  upsertRecord,
  deleteRecord,
  addSyncQueue,
  removeSyncQueueByRecordId,
} from '../data/indexeddb.js';
import { appStore } from './app.store.js';
import { transactionStore } from './transaction.store.js';

/**
 * @typedef {Object} Account
 * @property {string} id - UUID unik akun/dompet.
 * @property {string} name - Nama dompet (misal: 'BCA Utama', 'Gopay').
 * @property {number} initial_balance - Saldo awal saat dompet dibuat.
 * @property {string} icon - Nama icon Lucide (default: 'wallet').
 * @property {'active'|'archived'} status - Status keaktifan akun.
 * @property {string} created_at - Timestamp ISO pembuat akun.
 * @property {string} updated_at - Timestamp ISO pembaruan akun.
 */

/**
 * @typedef {Object} CreateAccountPayload
 * @property {string} name - Nama dompet.
 * @property {number|string} [initial_balance] - Saldo awal (default: 0).
 * @property {string} [icon] - Icon penanda (default: 'wallet').
 * @property {'active'|'archived'} [status] - Status akun (default: 'active').
 */

/**
 * Store Alpine.js untuk mengelola state dan operasi data Akun / Dompet (Local-First).
 */
export const accountStore = {
  /** @type {Array<Account>} List akun yang dimuat dari IndexedDB */
  accounts: [],

  /** @type {boolean} Status indikator pemuatan data */
  isLoading: false,

  /**
   * Memuat seluruh daftar akun dari IndexedDB ke dalam state aplikasi.
   * @returns {Promise<void>}
   */
  async loadAccounts() {
    this.isLoading = true;
    try {
      this.accounts = await getAllRecords('accounts');
    } catch (error) {
      console.error('[Account Store] Gagal memuat akun:', error);
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Menambahkan akun/dompet baru secara lokal, mencatat antrean sync, dan memperbarui state.
   * @param {CreateAccountPayload} payload - Data akun baru yang akan ditambahkan.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika operasi simpan lokal gagal.
   */
  async addAccount(payload) {
    const nowIso = new Date().toISOString();

    const newAccount = {
      id: crypto.randomUUID(),
      name: payload.name,
      initial_balance: Number(payload.initial_balance || 0),
      icon: payload.icon || 'wallet',
      status: payload.status || 'active',
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await upsertRecord('accounts', newAccount);

      await addSyncQueue({
        table: 'accounts',
        record_id: newAccount.id,
        operation: 'create',
      });

      this.accounts.push(newAccount);
      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Account Store] Gagal menambah akun:', error);
      throw error;
    }
  },

  /**
   * Memperbarui data akun yang ada berdasarkan ID secara lokal dan mencatat antrean sync.
   * @param {string} id - UUID akun yang akan di-update.
   * @param {Partial<CreateAccountPayload>} payload - Perubahan data akun.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika pembaruan lokal gagal.
   */
  async updateAccount(id, payload) {
    const existing = this.accounts.find((a) => a.id === id) || {};
    const updatedAccount = {
      ...existing,
      ...payload,
      id, // Memastikan ID tidak berubah
      initial_balance:
        payload.initial_balance !== undefined
          ? Number(payload.initial_balance)
          : existing.initial_balance,
      updated_at: new Date().toISOString(),
    };

    try {
      await upsertRecord('accounts', updatedAccount);

      await addSyncQueue({
        table: 'accounts',
        record_id: id,
        operation: 'update',
      });

      const index = this.accounts.findIndex((a) => a.id === id);
      if (index !== -1) {
        this.accounts[index] = updatedAccount;
      }

      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Account Store] Gagal memperbarui akun:', error);
      throw error;
    }
  },

  /**
   * Menghapus akun beserta seluruh transaksi terkait (sumber atau tujuan transaksi).
   * serta membersihkan antrean transaksi & mencatat antrean penghapusan akun.
   *
   * @param {string} id - UUID akun yang akan dihapus.
   */
  async deleteAccount(id) {
    try {
      // 1. Cari semua transaksi terkait
      const relatedTransactions = transactionStore.transactions.filter(
        (t) => t.account_id === id || t.to_account_id === id
      );

      // 2. Proses cascade penghapusan transaksi lokal
      for (const tx of relatedTransactions) {
        // Hapus dari indexedDB lokal
        await deleteRecord('transactions', tx.id);

        // Hapus antrean sync transaksi ini (agar tidak di push sia-sia ke supabase)
        await removeSyncQueueByRecordId('transactions', tx.id);
      }

      // Update state transaksi Alpine agar UI langsung bersih
      transactionStore.transactions = transactionStore.transactions.filter(
        (t) => t.account_id !== id && t.to_account_id !== id
      );

      // 3. PROSES PENGHAPUSAN AKUN LOKAL
      await deleteRecord('accounts', id);

      // Tambahkan/deduplikasi ke antrean sync untuk Akun
      await addSyncQueue({
        table: 'accounts',
        record_id: id,
        operation: 'delete',
      });

      // Update state akun Alpine
      this.accounts = this.accounts.filter((a) => a.id !== id);

      // Hitung ulang total antrean pending
      await appStore.updatePendingCount();
    } catch (error) {
      console.error(
        '[Account Store] Gagal menghapus akun secara cascade:',
        error
      );
      throw error;
    }
  },
};
