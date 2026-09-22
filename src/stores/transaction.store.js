// src/stores/transaction.store.js
import {
  getAllRecords,
  upsertRecord,
  deleteRecord,
  addSyncQueue,
} from '../data/indexeddb.js';
import { appStore } from './app.store.js';

/**
 * @typedef {Object} Transaction
 * @property {string} id - UUID unik transaksi.
 * @property {'income'|'expense'|'transfer'} type - Jenis transaksi keuangan.
 * @property {number} amount - Nominal transaksi.
 * @property {string} account_id - UUID akun/dompet sumber.
 * @property {string|null} to_account_id - UUID akun/dompet tujuan (khusus transfer).
 * @property {string|null} category_id - UUID kategori transaksi.
 * @property {number} fee - Biaya admin/transfer jika ada.
 * @property {string} transaction_date - Tanggal transaksi (Format: YYYY-MM-DD).
 * @property {string} description - Catatan/keterangan tambahan transaksi.
 * @property {string} created_at - Timestamp ISO pembuat transaksi.
 * @property {string} updated_at - Timestamp ISO pembaruan transaksi.
 */

/**
 * @typedef {Object} CreateTransactionPayload
 * @property {'income'|'expense'|'transfer'} [type] - Jenis transaksi (default: 'expense').
 * @property {number|string} amount - Nominal utama transaksi.
 * @property {string} [account_id] - UUID akun sumber.
 * @property {string} [to_account_id] - UUID akun tujuan (khusus transfer).
 * @property {string} [category_id] - UUID kategori.
 * @property {number|string} [fee] - Biaya tambahan (default: 0).
 * @property {string} [transaction_date] - Tanggal transaksi (YYYY-MM-DD).
 * @property {string} [description] - Deskripsi atau nama transaksi.
 * @property {string} [note] - Alias deskripsi (jika diinput via form catatan lama).
 */

/**
 * Store Alpine.js untuk pencatatan dan manipulasi Transaksi Keuangan (Local-First).
 */
export const transactionStore = {
  /** @type {Array<Transaction>} List transaksi yang dimuat dari IndexedDB */
  transactions: [],

  /** @type {boolean} Status indikator pemuatan data */
  isLoading: false,

  /**
   * Memuat seluruh daftar transaksi dari IndexedDB ke dalam state.
   * @returns {Promise<void>}
   */
  async loadTransactions() {
    this.isLoading = true;
    try {
      this.transactions = await getAllRecords('transactions');
    } catch (error) {
      console.error('[Transaction Store] Gagal memuat transaksi:', error);
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Menambahkan transaksi baru secara lokal di IndexedDB, mencatat antrean sync, dan memperbarui state.
   * @param {CreateTransactionPayload} payload - Data transaksi baru.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika pencatatan transaksi lokal gagal.
   */
  async addTransaction(payload) {
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const newTx = {
      id: crypto.randomUUID(),
      type: payload.type || 'expense',
      amount: Number(payload.amount),
      account_id: payload.account_id || '00000000-0000-0000-0000-000000000000',
      to_account_id: payload.to_account_id || null,
      category_id: payload.category_id || null,
      fee: Number(payload.fee || 0),
      transaction_date: payload.transaction_date || today,
      description: payload.description || payload.note || '',
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await upsertRecord('transactions', newTx);

      await addSyncQueue({
        table: 'transactions',
        record_id: newTx.id,
        operation: 'create',
      });

      this.transactions.push(newTx);
      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Transaction Store] Gagal menambah transaksi:', error);
      throw error;
    }
  },

  /**
   * Memperbarui data transaksi yang ada berdasarkan ID secara lokal dan mencatat antrean sync.
   * @param {string} id - UUID transaksi yang akan di-update.
   * @param {Partial<CreateTransactionPayload>} payload - Perubahan data transaksi.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika pembaruan lokal gagal.
   */
  async updateTransaction(id, payload) {
    const existing = this.transactions.find((t) => t.id === id) || {};
    const today = new Date().toISOString().split('T')[0];

    const updatedTransaction = {
      ...existing,
      ...payload,
      id, // Memastikan ID tidak berubah
      amount:
        payload.amount !== undefined ? Number(payload.amount) : existing.amount,
      fee: payload.fee !== undefined ? Number(payload.fee || 0) : existing.fee,
      account_id: payload.account_id || existing.account_id,
      to_account_id:
        payload.to_account_id !== undefined
          ? payload.to_account_id
          : existing.to_account_id,
      category_id:
        payload.category_id !== undefined
          ? payload.category_id
          : existing.category_id,
      transaction_date:
        payload.transaction_date || existing.transaction_date || today,
      description:
        payload.description !== undefined
          ? payload.description
          : existing.description,
      updated_at: new Date().toISOString(),
    };

    try {
      await upsertRecord('transactions', updatedTransaction);

      await addSyncQueue({
        table: 'transactions',
        record_id: id,
        operation: 'update',
      });

      const index = this.transactions.findIndex((t) => t.id === id);
      if (index !== -1) {
        this.transactions[index] = updatedTransaction;
      }

      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Transaction Store] Gagal memperbarui transaksi:', error);
      throw error;
    }
  },

  /**
   * Menghapus transaksi dari IndexedDB dan mencatat operasi 'delete' ke antrean sync.
   * @param {string} id - UUID transaksi yang akan dihapus.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika penghapusan lokal gagal.
   */
  async deleteTransaction(id) {
    try {
      await deleteRecord('transactions', id);

      await addSyncQueue({
        table: 'transactions',
        record_id: id,
        operation: 'delete',
      });

      this.transactions = this.transactions.filter((t) => t.id !== id);
      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Transaction Store] Gagal menghapus transaksi:', error);
      throw error;
    }
  },
};
