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
      // 1. Operasi Hapus ke Supabase
      const { error } = await supabase.from(table).delete().eq('id', record_id);

      if (error) throw error;
    } else {
      // 2. Operasi Create atau Update: Ambil data paling baru dari IndexedDB lokal
      const freshData = await getRecord(table, record_id);

      // Jika data ternyata sudah terhapus di lokal, anggap sukses dan lewati
      if (!freshData) return true;

      // Upsert data terbaru ke Supabase
      const { error } = await supabase.from(table).upsert(freshData);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error(
      `[Sync Engine] Gagal memproses queue ID ${queueItem.id} (Table: ${table}, Op: ${operation}):`,
      error
    );
    return false;
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
    // 1. Ambil seluruh daftar antrean dari IndexedDB
    const queueList = await getAllRecords('sync_queue');

    if (!queueList || queueList.length === 0) {
      return { success: true, processedCount: 0 };
    }

    let processedCount = 0;

    // 2. Iterasi dan proses kartu antrean satu per satu secara sekuensial
    for (const item of queueList) {
      const isSuccess = await processSyncQueue(item);

      if (isSuccess) {
        // Hapus kartu antrean hanya jika proses push sukses
        await removeSyncQueue(item.id);
        processedCount++;
      } else {
        // Hentikan eksekusi jika terjadi kesalahan/koneksi putus
        // Antrean tersisa tetap tersimpan aman di IndexedDB untuk dicoba lagi nanti
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
