// src/stores/app.store.js
import { getAllRecords, initDB } from '../data/indexeddb.js';
import { pushSync, pullSync } from '../services/sync.service.js';

/** Jam batas eksekusi auto-sync otomatis (21:00 malam) */
const SYNC_THRESHOLD_HOUR = 21;

/** Key localStorage untuk menyimpan tanggal terakhir berhasil sync */
const LAST_SYNCED_KEY = 'app_last_synced_date';

/**
 * Store Utama Aplikasi untuk mengelola status global, status sinkronisasi,
 * dan pemicu Auto-Sync/Manual-Sync.
 */
export const appStore = {
  /** @type {number} Jumlah transaksi/perubahan lokal yang belum tersinkron ke cloud */
  pendingCount: 0,

  /** @type {boolean} Status penanda apakah proses sinkronisasi sedang berjalan */
  isSyncing: false,

  /** @type {string|null} Tanggal terakhir kali sinkronisasi sukses dilakukan (Format: YYYY-MM-DD) */
  lastSyncedDate: localStorage.getItem(LAST_SYNCED_KEY) || null,

  /**
   * Inisialisasi awal aplikasi: Menyiapkan IndexedDB, memperbarui jumlah pending,
   * serta mendaftarkan Event Listener jaringan/visibilitas untuk auto-sync.
   * @returns {Promise<void>}
   */
  async initApp() {
    try {
      await initDB();
      await this.updatePendingCount();
      await this.checkAutoSyncThreshold();

      // Memicu auto sync saat device kembali terhubung ke internet
      window.addEventListener('online', () => {
        this.checkAutoSyncThreshold();
      });

      // Memicu auto sync saat user kembali fokus membuka tab browser
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkAutoSyncThreshold();
        }
      });
    } catch (error) {
      console.error('[App Store] Error pada initApp:', error);
    }
  },

  /**
   * Menghitung ulang total perubahan lokal yang ada di `sync_queue` IndexedDB.
   * @returns {Promise<void>}
   */
  async updatePendingCount() {
    try {
      const queue = await getAllRecords('sync_queue');
      this.pendingCount = queue ? queue.length : 0;
    } catch (error) {
      console.error('[App Store] Gagal memperbarui pendingCount:', error);
    }
  },

  /**
   * Pemicu eksekusi sinkronisasi data (Push perubahan lokal lalu Pull data terbaru dari Supabase).
   * @returns {Promise<boolean>} Mengembalikan true jika sync berhasil, atau false jika sedang berjalan.
   * @throws {Error} Mengembalikan error jika proses push/pull gagal.
   */
  async triggerSync() {
    if (this.isSyncing) return false;

    this.isSyncing = true;

    try {
      const tables = ['accounts', 'categories', 'transactions'];

      // 1. PUSH: Kirim semua perubahan lokal ke Supabase dulu
      const queueRecords = await getAllRecords('sync_queue');
      if (queueRecords.length > 0) {
        await pushSync();
      }

      // 2. PULL: Tarik data terbaru dari Supabase untuk menyelaraskan local DB
      for (const table of tables) {
        await pullSync(table);
      }

      // Catat tanggal sync sukses
      const today = new Date().toISOString().split('T')[0];
      this.lastSyncedDate = today;
      localStorage.setItem(LAST_SYNCED_KEY, today);

      return true;
    } catch (error) {
      console.error('[App Store] Error pada triggerSync:', error);
      throw error;
    } finally {
      await this.updatePendingCount();
      this.isSyncing = false;
    }
  },

  /**
   * Memeriksa kondisi kriteria auto-sync otomatis:
   * 1. Terdapat perubahan lokal (pendingCount > 0).
   * 2. Jam lokal sudah mencapai / melewati jam 21:00.
   * 3. Belum pernah melakukan sync pada hari ini.
   * @returns {Promise<void>}
   */
  async checkAutoSyncThreshold() {
    await this.updatePendingCount();

    if (this.pendingCount === 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const today = now.toISOString().split('T')[0];

    const isPastThreshold = currentHour >= SYNC_THRESHOLD_HOUR;
    const hasNotSyncedToday = this.lastSyncedDate !== today;

    if (isPastThreshold && hasNotSyncedToday) {
      console.log(
        '[App Store] Threshold jam 21:00 terpenuhi, menjalankan Auto-Sync...'
      );
      await this.triggerSync();
    }
  },
};
