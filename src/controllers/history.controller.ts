import { apiClient } from '../services/apiClient';
import { formatCurrency, formatDateGroup } from '../utils/formatters';
import { getCache, setCache } from '../utils/cache';
import type { WalletItem, CategoryItem, TransactionItem } from '../utils/types';

export interface TransactionGroup {
  dateGroup: string;
  totalAmount: number;
  count: number;
  items: TransactionItem[];
}

export function historyController() {
  return {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    activeTab: 'all',
    openFilterModal: false,
    openExportModal: false,
    showSearchInput: false,
    searchQuery: '',
    copiedJson: false,
    loading: true,

    selectedMonth: new Date().toISOString().slice(0, 7),
    filterDateFrom: '',
    filterDateTo: '',
    filterWalletId: '',
    filterCategoryId: '',

    transactions: [] as TransactionItem[],
    wallets: [] as WalletItem[],
    categories: [] as CategoryItem[],

    // ==========================================
    // 2. LIFECYCLE & SWR DATA FETCHING
    // ==========================================
    async init() {
      // Step 1: Load instan dari cache LocalStorage (0 ms delay)
      this.fetchDataFromCache();

      // Step 2: Revalidate data dari server di background
      await this.fetchData();
    },

    fetchDataFromCache() {
      const cachedTransactions = getCache<TransactionItem[]>(
        'studion_cache_transactions'
      );
      const cachedWallets = getCache<WalletItem[]>('studion_cache_wallets');
      const cachedCategories = getCache<CategoryItem[]>(
        'studion_cache_categories'
      );

      if (cachedTransactions) this.transactions = cachedTransactions;
      if (cachedWallets) this.wallets = cachedWallets;
      if (cachedCategories) this.categories = cachedCategories;

      if (cachedTransactions || cachedWallets || cachedCategories) {
        this.loading = false;
      }
    },

    async fetchData() {
      if (this.transactions.length === 0) {
        this.loading = true;
      }

      try {
        const [rawTransactions, rawWallets, rawCategories] = await Promise.all([
          apiClient.getTransactions<TransactionItem[]>(),
          apiClient.getWallets<WalletItem[]>(),
          apiClient.getCategories<CategoryItem[]>(),
        ]);

        this.transactions = rawTransactions;
        this.wallets = rawWallets;
        this.categories = rawCategories;

        setCache('studion_cache_transactions', rawTransactions);
        setCache('studion_cache_wallets', rawWallets);
        setCache('studion_cache_categories', rawCategories);
      } catch (e) {
        console.error(
          'SWR Revalidate History Failed, menggunakan data cache:',
          e
        );
      } finally {
        this.loading = false;
      }
    },

    // ==========================================
    // 3. COMPUTED / GETTERS (FILTER & GROUPING)
    // ==========================================
    get formattedSelectedMonth() {
      if (!this.selectedMonth) return 'Semua Periode';
      const [year, month] = this.selectedMonth.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    },

    get hasActiveAdvanceFilter() {
      return !!(
        this.filterDateFrom ||
        this.filterDateTo ||
        this.filterWalletId ||
        this.filterCategoryId
      );
    },

    get filteredTransactions() {
      return this.transactions.filter((item: TransactionItem) => {
        const matchTab =
          this.activeTab === 'all' || item.type === this.activeTab;

        const q = this.searchQuery.toLowerCase().trim();
        const matchQuery =
          !q ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.categories && item.categories.name.toLowerCase().includes(q)) ||
          (item.wallets && item.wallets.name.toLowerCase().includes(q)) ||
          (item.to_wallets && item.to_wallets.name.toLowerCase().includes(q));

        const txDate = item.transaction_date
          ? item.transaction_date.split('T')[0]
          : '';
        const matchMonth =
          q || this.filterDateFrom || this.filterDateTo || !this.selectedMonth
            ? true
            : txDate.startsWith(this.selectedMonth);

        const matchFrom = !this.filterDateFrom || txDate >= this.filterDateFrom;
        const matchTo = !this.filterDateTo || txDate <= this.filterDateTo;

        const matchWallet =
          !this.filterWalletId ||
          item.wallet_id === this.filterWalletId ||
          item.to_wallet_id === this.filterWalletId;

        const matchCategory =
          !this.filterCategoryId || item.category_id === this.filterCategoryId;

        return (
          matchTab &&
          matchQuery &&
          matchMonth &&
          matchFrom &&
          matchTo &&
          matchWallet &&
          matchCategory
        );
      });
    },

    get groupedTransactions() {
      const groups: Record<string, TransactionGroup> = {};

      this.filteredTransactions.forEach((item: TransactionItem) => {
        const groupKey = this.formatDateGroup(
          item.transaction_date || item.created_at
        );

        if (!groups[groupKey]) {
          groups[groupKey] = {
            dateGroup: groupKey,
            totalAmount: 0,
            count: 0,
            items: [],
          };
        }

        groups[groupKey].items.push(item);
        groups[groupKey].count += 1;

        if (item.type === 'income')
          groups[groupKey].totalAmount += Number(item.amount || 0);
        if (item.type === 'expense')
          groups[groupKey].totalAmount -= Number(item.amount || 0);
      });

      return Object.values(groups);
    },

    // ==========================================
    // 4. UI HANDLERS & NAVIGATION
    // ==========================================
    openMonthPicker() {
      const input = (this as any).$refs.monthInput;
      if (input) {
        if ('showPicker' in HTMLInputElement.prototype) {
          input.showPicker();
        } else {
          input.click();
        }
      }
    },

    toggleSearch() {
      this.showSearchInput = !this.showSearchInput;
      if (this.showSearchInput) {
        setTimeout(() => {
          const input = document.querySelector(
            'input[x-ref="searchInput"]'
          ) as HTMLInputElement;
          input?.focus();
        }, 100);
      } else {
        this.searchQuery = '';
      }
    },

    resetAdvanceFilters() {
      this.filterDateFrom = '';
      this.filterDateTo = '';
      this.filterWalletId = '';
      this.filterCategoryId = '';
      this.openFilterModal = false;
    },

    goToEditPage(id: string) {
      window.location.href = `/transaction?id=${id}`;
    },

    formatCurrency(val: number, type?: string) {
      return formatCurrency(val, type);
    },

    formatDateGroup(dateStr?: string) {
      return formatDateGroup(dateStr);
    },

    // ==========================================
    // 5. EXPORT & DOWNLOAD DATA
    // ==========================================
    getFormattedExportData() {
      return this.filteredTransactions.map((item: TransactionItem) => ({
        id: item.id,
        tanggal: item.transaction_date
          ? item.transaction_date.split('T')[0]
          : '',
        tipe: item.type,
        nominal: item.amount,
        catatan: item.notes || '',
        kategori: item.categories?.name || 'Umum',
        dompet_asal: item.wallets?.name || '',
        dompet_tujuan: item.to_wallets?.name || '',
      }));
    },

    exportCSV() {
      const data = this.getFormattedExportData();
      const headers = [
        'Tanggal',
        'Tipe',
        'Nominal',
        'Catatan',
        'Kategori',
        'Dompet_Asal',
        'Dompet_Tujuan',
      ];
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          [
            `"${row.tanggal}"`,
            `"${row.tipe}"`,
            row.nominal,
            `"${(row.catatan || '').replace(/"/g, '""')}"`,
            `"${row.kategori}"`,
            `"${row.dompet_asal}"`,
            `"${row.dompet_tujuan}"`,
          ].join(',')
        ),
      ];

      const blob = new Blob([csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      this.downloadFile(
        blob,
        `transaksi_studion_${new Date().toISOString().slice(0, 10)}.csv`
      );
      this.openExportModal = false;
    },

    downloadJSON() {
      const data = this.getFormattedExportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      this.downloadFile(
        blob,
        `transaksi_studion_${new Date().toISOString().slice(0, 10)}.json`
      );
      this.openExportModal = false;
    },

    async copyJSON() {
      const data = this.getFormattedExportData();
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        this.copiedJson = true;
        setTimeout(() => {
          this.copiedJson = false;
        }, 2000);
      } catch (e) {
        alert('Gagal menyalin data JSON!');
      }
    },

    downloadFile(blob: Blob, filename: string) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}
