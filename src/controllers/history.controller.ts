import { apiClient } from '../services/apiClient';
import { formatCurrency, formatDateGroup } from '../utils/formatters';

export interface WalletItem {
  id: string;
  name: string;
  [key: string]: any;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: string;
  icon?: string;
  [key: string]: any;
}

export interface TransactionItem {
  id: string;
  notes?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  wallet_id?: string;
  to_wallet_id?: string;
  category_id?: string;
  transaction_date?: string;
  created_at?: string;
  wallets?: WalletItem;
  to_wallets?: WalletItem;
  categories?: CategoryItem;
  [key: string]: any;
}

export interface TransactionGroup {
  dateGroup: string;
  items: TransactionItem[];
}

export function historyController() {
  return {
    activeTab: 'all',
    openFilterModal: false,
    openExportModal: false,
    showSearchInput: false,
    searchQuery: '',
    copiedJson: false,

    selectedMonth: new Date().toISOString().slice(0, 7),

    filterDateFrom: '',
    filterDateTo: '',
    filterWalletId: '',
    filterCategoryId: '',

    transactions: [] as TransactionItem[],
    wallets: [] as WalletItem[],
    categories: [] as CategoryItem[],
    loading: true,

    init() {
      this.fetchData();
    },

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

    async fetchData() {
      this.loading = true;
      try {
        const [rawTransactions, rawWallets, rawCategories] = await Promise.all([
          apiClient.getTransactions<TransactionItem[]>(),
          apiClient.getWallets<WalletItem[]>(),
          apiClient.getCategories<CategoryItem[]>(),
        ]);

        this.transactions = rawTransactions;
        this.wallets = rawWallets;
        this.categories = rawCategories;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
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

    resetAdvanceFilters() {
      this.filterDateFrom = '';
      this.filterDateTo = '';
      this.filterWalletId = '';
      this.filterCategoryId = '';
      this.openFilterModal = false;
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
      const groups: Record<
        string,
        {
          dateGroup: string;
          totalAmount: number;
          count: number;
          items: TransactionItem[];
        }
      > = {};

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

        // Hitung Net Flow hari itu (Income menambah, Expense mengurangi)
        if (item.type === 'income')
          groups[groupKey].totalAmount += Number(item.amount);
        if (item.type === 'expense')
          groups[groupKey].totalAmount -= Number(item.amount);
      });

      return Object.values(groups);
    },

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
