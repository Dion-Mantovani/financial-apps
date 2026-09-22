// src/features/history.ui.js

/**
 * Controller / UI Store Alpine.js untuk Halaman Riwayat Transaksi (History UI).
 * Mengelola filter, pencarian, pengelompokan tanggal, dan ekspor data (JSON/CSV).
 *
 * @returns {Object} Alpine Component Object
 */
export function historyUI() {
  return {
    /*
     * ==========================================
     * 1. STATE & COMPONENT UI PROPS
     * ==========================================
     */
    showSearchInput: false,
    searchQuery: '',

    /** @type {string} Format YYYY-MM */
    selectedMonth: (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })(),

    showMonthPicker: false,
    activeTab: 'all', // 'all' | 'income' | 'expense' | 'transfer' | 'upcoming'

    openFilterModal: false,
    openExportModal: false,

    filterWalletId: '',
    filterCategoryId: '',

    filterDateFrom: '',
    filterDateTo: '',

    copiedJson: false,

    /*
     * ==========================================
     * 2. LIFECYCLE HOOKS
     * ==========================================
     */

    /**
     * Inisialisasi data halaman history dengan memuat akun, kategori, dan transaksi dari Alpine Stores.
     * @returns {Promise<void>}
     */
    async init() {
      await Promise.all([
        Alpine.store('account').loadAccounts(),
        Alpine.store('category').loadCategories(),
        Alpine.store('transaction').loadTransactions(),
      ]);
    },

    /*
     * ==========================================
     * 3. DATA ACCESSORS (GLOBAL STORES)
     * ==========================================
     */

    /** @returns {Array<Object>} Daftar akun dari accountStore */
    get wallets() {
      return Alpine.store('account')?.accounts || [];
    },

    /** @returns {Array<Object>} Daftar kategori dari categoryStore */
    get categories() {
      return Alpine.store('category')?.categories || [];
    },

    /** @returns {Array<Object>} Daftar transaksi dari transactionStore */
    get transactions() {
      return Alpine.store('transaction')?.transactions || [];
    },

    /*
     * ==========================================
     * 4. DATE & MONTH GETTERS / HELPERS
     * ==========================================
     */

    /**
     * Menghasilkan label rentang tanggal atau bulan aktif untuk header/filter UI.
     * @returns {string} Text label tanggal (misal: "1 Jan - 15 Jan" atau "Januari 2026")
     */
    get dateFilterLabel() {
      if (!this.filterDateFrom && !this.filterDateTo) {
        return this.currentMonthLabel;
      }

      const formatDate = (dateStr, showYear = false) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          ...(showYear ? { year: '2-digit' } : {}),
        });
      };

      if (this.filterDateFrom && this.filterDateTo) {
        return `${formatDate(this.filterDateFrom)} - ${formatDate(this.filterDateTo)}`;
      }

      if (this.filterDateFrom) {
        return `Dari ${formatDate(this.filterDateFrom, true)}`;
      }

      return `Sampai ${formatDate(this.filterDateTo, true)}`;
    },

    /**
     * Menghasilkan nama bulan dan tahun berdasarkan state selectedMonth.
     * @returns {string} Contoh: "Januari 2026"
     */
    get currentMonthLabel() {
      const [year, month] = this.selectedMonth.split('-');
      return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
        'id-ID',
        { month: 'long', year: 'numeric' }
      );
    },

    /**
     * Mengubah bulan yang dipilih berdasarkan offset (-1 untuk bulan lalu, +1 untuk bulan depan).
     * @param {number} offset - Angka penambah/pengurang bulan
     */
    changeMonth(offset) {
      const [year, month] = this.selectedMonth.split('-');
      const date = new Date(Number(year), Number(month) - 1 + offset, 1);
      this.selectedMonth = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;
    },

    /**
     * Memformat string tanggal (YYYY-MM-DD) menjadi label grup seperti "Hari Ini", "Kemarin", atau "15 Jan 2026".
     * @param {string} dateString - Format YYYY-MM-DD
     * @returns {string} Label tanggal terformat
     */
    formatDateGroup(dateString) {
      if (!dateString) return '';

      const [year, month, day] = dateString.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      targetDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const formattedDate = targetDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      if (targetDate.getTime() === today.getTime()) {
        return `Hari Ini, ${formattedDate}`;
      }

      if (targetDate.getTime() === yesterday.getTime()) {
        return `Kemarin, ${formattedDate}`;
      }

      return formattedDate;
    },

    /*
     * ==========================================
     * 5. FILTERING & COMPUTED DATA
     * ==========================================
     */

    /**
     * Menyaring array transaksi berdasarkan tab aktif, rentang tanggal, wallet, kategori, dan pencarian teks.
     * Menggunakan HashMap Lookup untuk performa pencarian tinggi.
     * @returns {Array<Object>} Array transaksi yang lolos kriteria filter
     */
    get filteredTransactions() {
      const query = this.searchQuery.trim().toLowerCase();

      // Fast Lookup Maps untuk optimasi performa pencarian
      const walletMap = new Map(this.wallets.map((w) => [w.id, w.name]));
      const categoryMap = new Map(this.categories.map((c) => [c.id, c.name]));

      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      return this.transactions.filter((tx) => {
        // Filter Upcoming (Transaksi mendatang)
        if (this.activeTab === 'upcoming') {
          if (!tx.transaction_date || tx.transaction_date <= todayString) {
            return false;
          }
        } else {
          // Filter Rentang Tanggal / Bulan
          if (this.filterDateFrom || this.filterDateTo) {
            if (
              this.filterDateFrom &&
              tx.transaction_date < this.filterDateFrom
            )
              return false;
            if (this.filterDateTo && tx.transaction_date > this.filterDateTo)
              return false;
          } else if (
            this.selectedMonth &&
            tx.transaction_date?.slice(0, 7) !== this.selectedMonth
          ) {
            return false;
          }

          // Filter Tipe Transaksi ('income', 'expense', 'transfer')
          if (this.activeTab !== 'all' && tx.type !== this.activeTab) {
            return false;
          }
        }

        // Filter Wallet (Akun Asal / Akun Tujuan)
        if (this.filterWalletId) {
          if (
            tx.account_id !== this.filterWalletId &&
            tx.to_account_id !== this.filterWalletId
          ) {
            return false;
          }
        }

        // Filter Kategori
        if (this.filterCategoryId && tx.category_id !== this.filterCategoryId) {
          return false;
        }

        // Search Query Text
        if (query) {
          const sourceName = walletMap.get(tx.account_id) || '';
          const destName = walletMap.get(tx.to_account_id) || '';
          const categoryName = categoryMap.get(tx.category_id) || '';

          const searchableText =
            `${tx.description || ''} ${tx.type || ''} ${sourceName} ${destName} ${categoryName}`.toLowerCase();

          if (!searchableText.includes(query)) {
            return false;
          }
        }

        return true;
      });
    },

    /**
     * Mengelompokkan transaksi tersaring berdasarkan tanggal (YYYY-MM-DD)
     * dan menghitung kalkulasi total arus kas harian.
     * @returns {Array<Object>} Array grup tanggal berisi daftar item transaksi
     */
    get groupedTransactions() {
      const groups = {};
      const walletMap = new Map(this.wallets.map((w) => [w.id, w]));
      const categoryMap = new Map(this.categories.map((c) => [c.id, c]));

      this.filteredTransactions.forEach((tx) => {
        const date = tx.transaction_date;
        if (!date) return;

        if (!groups[date]) {
          groups[date] = {
            date,
            dateGroup: this.formatDateGroup(date),
            count: 0,
            totalAmount: 0,
            items: [],
          };
        }

        const amount = Number(tx.amount || 0);
        const fee = Number(tx.fee || 0);

        const sourceAccount = walletMap.get(tx.account_id);
        const destinationAccount = walletMap.get(tx.to_account_id);
        const category = categoryMap.get(tx.category_id);

        // Kalkulasi Cashflow Harian
        if (tx.type === 'income') {
          groups[date].totalAmount += amount;
        } else if (tx.type === 'expense') {
          groups[date].totalAmount -= amount;
        } else if (tx.type === 'transfer') {
          groups[date].totalAmount -= fee;
        }

        let icon =
          tx.type === 'transfer' ? 'transfer' : category?.icon || 'wallet';
        let categoryLabel =
          tx.type === 'transfer'
            ? 'Transfer'
            : category?.name || 'Tanpa Kategori';

        let walletLabel = sourceAccount?.name || '-';
        if (tx.type === 'transfer') {
          walletLabel = `${sourceAccount?.name || '-'} → ${destinationAccount?.name || '-'}`;
        }

        let amountLabel = `Rp ${amount.toLocaleString('id-ID')}`;
        if (tx.type === 'income')
          amountLabel = `+Rp ${amount.toLocaleString('id-ID')}`;
        if (tx.type === 'expense')
          amountLabel = `-Rp ${amount.toLocaleString('id-ID')}`;

        groups[date].count += 1;
        groups[date].items.push({
          id: tx.id,
          created_at: tx.created_at,
          icon,
          notes: tx.description || categoryLabel,
          category: categoryLabel,
          wallet: walletLabel,
          amount: amountLabel,
          fee:
            tx.type === 'transfer' && fee > 0
              ? `Rp ${fee.toLocaleString('id-ID')}`
              : null,
          type: tx.type,
        });
      });

      // Urutkan transaksi di dalam grup berdasarkan waktu buat terbaru
      Object.values(groups).forEach((group) => {
        group.items.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
      });

      // Urutkan grup berdasarkan tanggal transaksi terbaru
      return Object.values(groups).sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    },

    /*
     * ==========================================
     * 6. USER ACTIONS & MODAL CONTROLLERS
     * ==========================================
     */

    /**
     * Membersihkan seluruh filter modal (tanggal, wallet, kategori) dan menutup modal filter.
     */
    clearFilters() {
      this.filterDateFrom = '';
      this.filterDateTo = '';
      this.filterWalletId = '';
      this.filterCategoryId = '';
      this.openFilterModal = false;
    },

    /**
     * Navigasi ke halaman detail / edit transaksi berdasarkan ID.
     * @param {string} id - ID transaksi
     */
    openTransaction(id) {
      if (!id) return;
      window.location.href = `/transaction?id=${id}`;
    },

    /*
     * ==========================================
     * 7. EXPORT DATA (JSON & CSV)
     * ==========================================
     */

    /**
     * Menyalin hasil filter transaksi saat ini ke clipboard dalam format JSON.
     * @returns {Promise<void>}
     */
    async copyJSON() {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(this.filteredTransactions, null, 2)
        );
        this.copiedJson = true;
        setTimeout(() => {
          this.copiedJson = false;
        }, 2000);
      } catch (error) {
        console.error('[History UI] Gagal menyalin JSON:', error);
      }
    },

    /**
     * Mengunduh data transaksi tersaring sebagai file file .json.
     */
    downloadJSON() {
      const json = JSON.stringify(this.filteredTransactions, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `transactions-${this.selectedMonth || 'all'}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },

    /**
     * Mengunduh data transaksi tersaring sebagai file .csv dengan encoder UTF-8.
     */
    downloadCSV() {
      if (!this.filteredTransactions.length) return;

      const walletMap = new Map(this.wallets.map((w) => [w.id, w.name]));
      const categoryMap = new Map(this.categories.map((c) => [c.id, c.name]));

      const headers = [
        'ID',
        'Tanggal',
        'Tipe',
        'Nominal',
        'Biaya Admin',
        'Akun Asal',
        'Akun Tujuan',
        'Kategori',
        'Deskripsi',
      ];

      const rows = this.filteredTransactions.map((tx) => [
        `"${tx.id}"`,
        `"${tx.transaction_date}"`,
        `"${tx.type}"`,
        tx.amount || 0,
        tx.fee || 0,
        `"${walletMap.get(tx.account_id) || ''}"`,
        `"${walletMap.get(tx.to_account_id) || ''}"`,
        `"${categoryMap.get(tx.category_id) || ''}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute(
        'download',
        `transactions-${this.selectedMonth || 'all'}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
  };
}
