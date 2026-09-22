// src/stores/category.store.js
import {
  getAllRecords,
  upsertRecord,
  deleteRecord,
  addSyncQueue,
} from '../data/indexeddb.js';
import { appStore } from './app.store.js';

/**
 * @typedef {Object} Category
 * @property {string} id - UUID unik kategori.
 * @property {string} name - Nama kategori (misal: 'Makanan', 'Gaji').
 * @property {'income'|'expense'} type - Tipe transaksi kategori.
 * @property {string} icon - Nama icon Lucide penanda kategori.
 * @property {boolean} is_default - Penanda apakah kategori bawaan sistem.
 * @property {string} created_at - Timestamp ISO pembuat kategori.
 * @property {string} updated_at - Timestamp ISO pembaruan kategori.
 */

/**
 * @typedef {Object} CreateCategoryPayload
 * @property {string} name - Nama kategori.
 * @property {'income'|'expense'} [type] - Tipe transaksi (default: 'expense').
 * @property {string} [icon] - Icon penanda (default: 'folder').
 * @property {boolean} [is_default] - Penanda kategori bawaan (default: false).
 */

/**
 * Store Alpine.js untuk mengelola data Kategori Transaksi (Local-First).
 */
export const categoryStore = {
  /** @type {Array<Category>} List kategori yang dimuat dari IndexedDB */
  categories: [],

  /** @type {boolean} Status indikator pemuatan data */
  isLoading: false,

  /**
   * Memuat seluruh daftar kategori dari IndexedDB ke dalam state.
   * @returns {Promise<void>}
   */
  async loadCategories() {
    this.isLoading = true;
    try {
      this.categories = await getAllRecords('categories');
    } catch (error) {
      console.error('[Category Store] Gagal memuat kategori:', error);
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Menambahkan kategori baru ke IndexedDB, mencatat antrean sync, dan memperbarui state.
   * @param {CreateCategoryPayload} payload - Data kategori baru.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika operasi simpan lokal gagal.
   */
  async addCategory(payload) {
    const nowIso = new Date().toISOString();

    const newCategory = {
      id: crypto.randomUUID(),
      name: payload.name,
      type: payload.type || 'expense',
      icon: payload.icon || 'folder',
      is_default: Boolean(payload.is_default || false),
      created_at: nowIso,
      updated_at: nowIso,
    };

    try {
      await upsertRecord('categories', newCategory);

      await addSyncQueue({
        table: 'categories',
        record_id: newCategory.id,
        operation: 'create',
      });

      this.categories.push(newCategory);
      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Category Store] Gagal menambah kategori:', error);
      throw error;
    }
  },

  /**
   * Memperbarui data kategori berdasarkan ID dan mencatat operasi ke antrean sync.
   * @param {string} id - UUID kategori yang akan di-update.
   * @param {Partial<CreateCategoryPayload>} payload - Perubahan data kategori.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika pembaruan lokal gagal.
   */
  async updateCategory(id, payload) {
    const existing = this.categories.find((c) => c.id === id) || {};
    const updatedCategory = {
      ...existing,
      ...payload,
      id, // Memastikan ID tidak berubah
      is_default:
        payload.is_default !== undefined
          ? Boolean(payload.is_default)
          : existing.is_default,
      updated_at: new Date().toISOString(),
    };

    try {
      await upsertRecord('categories', updatedCategory);

      await addSyncQueue({
        table: 'categories',
        record_id: id,
        operation: 'update',
      });

      const index = this.categories.findIndex((c) => c.id === id);
      if (index !== -1) {
        this.categories[index] = updatedCategory;
      }

      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Category Store] Gagal memperbarui kategori:', error);
      throw error;
    }
  },

  /**
   * Menghapus kategori dari IndexedDB dan menambahkan kartu antrean penghapusan.
   * @param {string} id - UUID kategori yang akan dihapus.
   * @returns {Promise<void>}
   * @throws {Error} Mengembalikan error jika penghapusan lokal gagal.
   */
  async deleteCategory(id) {
    try {
      await deleteRecord('categories', id);

      await addSyncQueue({
        table: 'categories',
        record_id: id,
        operation: 'delete',
      });

      this.categories = this.categories.filter((c) => c.id !== id);
      await appStore.updatePendingCount();
    } catch (error) {
      console.error('[Category Store] Gagal menghapus kategori:', error);
      throw error;
    }
  },
};
