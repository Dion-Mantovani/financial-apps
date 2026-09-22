// src/data/indexeddb.js
import { openDB } from 'idb';

const DB_NAME = 'FinancialAppDB';
const DB_VERSION = 1;

/**
 * Inisialisasi IndexedDB dan membuat Object Stores yang dibutuhkan.
 * Menggunakan library 'idb' untuk wrapper Promise-based.
 *
 * @returns {Promise<IDBPDatabase>} Instance database IndexedDB
 */
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Store untuk data utama
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // Store khusus penampung kartu antrean sinkronisasi
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        // Index untuk mempermudah pencarian deduplikasi berdasarkan tabel & record_id
        syncStore.createIndex('record_id', 'record_id', { unique: false });
      }
    },
  });
}

/**
 * Mengambil satu baris data spesifik berdasarkan ID dari Object Store tertentu.
 *
 * @param {string} storeName - Nama object store ('transactions', 'accounts', dll)
 * @param {string|number} id - ID data yang dicari
 * @returns {Promise<Object|undefined>} Object data atau undefined jika tidak ditemukan
 */
export async function getRecord(storeName, id) {
  const db = await initDB();
  return db.get(storeName, id);
}

/**
 * Mengambil seluruh baris data dari Object Store tertentu.
 *
 * @param {string} storeName - Nama object store
 * @returns {Promise<Array>} Array berisi seluruh data di store tersebut
 */
export async function getAllRecords(storeName) {
  const db = await initDB();
  return db.getAll(storeName);
}

/**
 * Menyimpan data baru atau memperbarui data lama (Upsert) berdasarkan Primary Key (id).
 *
 * @param {string} storeName - Nama object store
 * @param {Object} data - Object data yang wajib memiliki property 'id'
 * @returns {Promise<string|number>} Key dari data yang disimpan
 */
export async function upsertRecord(storeName, data) {
  const db = await initDB();
  return db.put(storeName, data);
}

/**
 * Menghapus satu baris data dari Object Store tertentu berdasarkan ID.
 *
 * @param {string} storeName - Nama object store
 * @param {string|number} id - ID data yang akan dihapus
 * @returns {Promise<void>}
 */
export async function deleteRecord(storeName, id) {
  const db = await initDB();
  return db.delete(storeName, id);
}

/**
 * Menambahkan kartu antrean ke sync_queue dengan OPERASI DEDUPLIKASI.
 * Jika antrean untuk record_id & table yang sama sudah ada:
 * - Operasi 'create' lalu 'update' -> Tetap 'create' (payload diperbarui di store utama).
 * - Operasi 'update' lalu 'update' -> Tetap 'update'.
 * - Operasi 'create' lalu 'delete' -> Hapus kartu antrean (karena data belum pernah ke cloud).
 * - Operasi 'update' lalu 'delete' -> Ubah operasi jadi 'delete'.
 *
 * @param {Object} queueData - Object berisi { table, record_id, operation }
 * @returns {Promise<void>}
 */
export async function addSyncQueue({ table, record_id, operation }) {
  const db = await initDB();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');

  // Cari apakah sudah ada antrean pending untuk record_id & table ini
  const allQueue = await store.getAll();
  const existingQueue = allQueue.find(
    (item) => item.table === table && item.record_id === record_id
  );

  const timestamp = new Date().toISOString();

  if (existingQueue) {
    // Deduplikasi Operasi
    if (existingQueue.operation === 'create' && operation === 'delete') {
      // Jika baru dibuat di lokal lalu dihapus sebelum sync, membatalkan antrean sepenuhnya
      await store.delete(existingQueue.id);
    } else if (existingQueue.operation === 'create' && operation === 'update') {
      // Jika baru dibuat lalu di-edit, operasi tetap 'create'
      existingQueue.created_at = timestamp;
      await store.put(existingQueue);
    } else {
      // Untuk kombinasi lain (update -> update, atau update -> delete), timpa operasinya
      existingQueue.operation = operation;
      existingQueue.created_at = timestamp;
      await store.put(existingQueue);
    }
  } else {
    // Jika belum ada di antrean, buat kartu antrean baru
    await store.add({
      table,
      record_id,
      operation,
      created_at: timestamp,
    });
  }

  await tx.done;
}

/**
 * Menghapus kartu antrean dari sync_queue setelah berhasil disinkronkan ke Supabase.
 *
 * @param {number} queueId - ID autoIncrement dari item di sync_queue
 * @returns {Promise<void>}
 */
export async function removeSyncQueue(queueId) {
  const db = await initDB();
  return db.delete('sync_queue', queueId);
}
