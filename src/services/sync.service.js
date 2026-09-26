// src/services/sync.service.js
import { supabase } from '../data/supabase.js';
import {
  getAllRecords,
  getRecord,
  removeSyncQueue,
  upsertRecord,
} from '../data/indexeddb.js';

/**
 * @typedef {Object} SyncQueueItem
 * @property {number} id - Auto-increment ID kartu antrean dari IndexedDB.
 * @property {string} table - Nama tabel tujuan ('accounts', 'categories', 'transactions').
 * @property {string} record_id - UUID unik dari record yang diubah.
 * @property {'create'|'update'|'delete'} operation - Tipe operasi sinkronisasi.
 * @property {string} created_at - Timestamp ISO pembuat kartu antrean.
 */

/**
 * @typedef {Object} PushSyncResult
 * @property {boolean} success - Status keberhasilan eksekusi push sync.
 * @property {number} processedCount - Total item antrean yang berhasil dikirim & diproses.
 */

/**
 * Helper internal untuk mengeksekusi 1 item kartu antrean dari IndexedDB ke Supabase.
 * Mengambil data paling fresh dari IndexedDB jika operasinya adalah 'create' atau 'update'.
 *
 * @param {SyncQueueItem} queueItem - Object kartu antrean yang akan dieksekusi.
 * @returns {Promise<boolean>} Resolves true jika berhasil terkirim/diproses, false jika gagal.
 */
export async function processSyncQueue(queueItem) {
  const { table, record_id, operation } = queueItem;

  try {
    if (operation === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', record_id);
      if (error) throw error;
    } else {
      const freshData = await getRecord(table, record_id);
      if (!freshData) return { status: 'success' };

      const { error } = await supabase.from(table).upsert(freshData);

      if (error) {
        // Jika error dikarenakan Foreign Key tidak ditemukan (misal Akun/Kategori sudah dihapus di device lain)
        if (error.code === '23503') {
          // 23503 = Postgres foreign_key_violation
          console.warn(
            `[Sync Engine] Foreign key hilang untuk queue ID ${queueItem.id}. Skipping...`
          );
          return { status: 'invalid_data', error };
        }
        throw error;
      }
    }

    return { status: 'success' };
  } catch (error) {
    console.error(
      `[Sync Engine] Gagal memproses queue ID ${queueItem.id} (Table: ${table}, Op: ${operation}):`,
      error
    );
    return { status: 'network_error', error };
  }
}

/**
 * Mendorong (Push) semua perubahan antrean di `sync_queue` IndexedDB ke Supabase.
 * Kartu antrean hanya dihapus dari IndexedDB jika respon dari Supabase mengembalikan sukses.
 * Jika ada 1 item gagal (misal koneksi terputus), iterasi dihentikan agar urutan sync tidak kacau.
 *
 * @returns {Promise<PushSyncResult>} Status hasil akhir proses push sync.
 */
export async function pushSync() {
  try {
    const queueList = await getAllRecords('sync_queue');

    if (!queueList || queueList.length === 0) {
      return { success: true, processedCount: 0 };
    }

    let processedCount = 0;

    for (const item of queueList) {
      const result = await processSyncQueue(item);

      if (result.status === 'success' || result.status === 'invalid_data') {
        // Hapus antrean jika sukses ATAU jika datanya memang invalid (FK error) agar antrean tidak macet
        await removeSyncQueue(item.id);
        processedCount++;
      } else if (result.status === 'network_error') {
        // Hanya hentikan antrean jika murni error koneksi/network
        break;
      }
    }

    return { success: true, processedCount };
  } catch (error) {
    console.error('[Sync Engine] Critical error pada pushSync:', error);
    return { success: false, processedCount: 0 };
  }
}

/**
 * Menarik (Pull) data terbaru dari Supabase dan menimpanya ke IndexedDB lokal.
 * Digunakan untuk restore data awal atau penyelarasan saat manual sync.
 *
 * @param {string} table - Nama tabel Supabase yang ingin di-pull ('accounts', 'categories', 'transactions')
 * @returns {Promise<boolean>} Resolves true jika pull berhasil, false jika gagal.
 */
export async function pullSync(table) {
  try {
    // 1. Tarik seluruh baris data dari tabel Supabase
    const { data, error } = await supabase.from(table).select('*');

    if (error) throw error;

    if (data && data.length > 0) {
      // 2. Simpan/timpa tiap record ke IndexedDB lokal secara paralel/sekuensial
      for (const record of data) {
        await upsertRecord(table, record);
      }
    }

    return true;
  } catch (error) {
    console.error(`[Sync Engine] Error pada pullSync tabel '${table}':`, error);
    return false;
  }
}
