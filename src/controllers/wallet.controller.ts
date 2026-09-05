import { apiClient } from '../services/apiClient';
import { formatCurrency } from '../utils/formatters';
import {
  calculateSingleWalletBalance,
  calculateTotalBalance,
} from '../utils/calculations';

export interface WalletItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
  [key: string]: any;
}

export interface TransactionItem {
  wallet_id: string;
  to_wallet_id?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  transaction_date?: string;
  created_at?: string;
  [key: string]: any;
}

export function walletController() {
  return {
    viewMode: localStorage.getItem('studion_wallet_view_mode') || 'card',
    previousViewMode: 'card',
    isReordering: false,
    initialOrderJson: '',

    wallets: [] as WalletItem[],
    transactions: [] as TransactionItem[],
    loading: true,

    openDetailModal: false,
    openFormModal: false,
    detailStatsPeriod: '1m',

    isEdit: false,
    selectedWallet: {} as WalletItem,
    formData: {
      id: '',
      name: '',
      type: 'bank',
      balance: 0,
      color: '#2563eb',
      icon: 'landmark',
    },

    init() {
      this.fetchAllData();
    },

    toggleViewMode() {
      this.viewMode = this.viewMode === 'card' ? 'list' : 'card';
      localStorage.setItem('studion_wallet_view_mode', this.viewMode);
    },

    applyLocalStorageOrder(fetchedWallets: WalletItem[]) {
      const savedOrderJson = localStorage.getItem('studion_wallet_sort_order');
      if (!savedOrderJson) return fetchedWallets;

      try {
        const savedOrderIds: string[] = JSON.parse(savedOrderJson);
        return [...fetchedWallets].sort((a, b) => {
          const indexA = savedOrderIds.indexOf(a.id);
          const indexB = savedOrderIds.indexOf(b.id);

          if (indexA === -1) return -1;
          if (indexB === -1) return 1;

          return indexA - indexB;
        });
      } catch (e) {
        console.error('Error parsing wallet sort order:', e);
        return fetchedWallets;
      }
    },

    toggleReorderMode() {
      if (!this.isReordering) {
        this.previousViewMode = this.viewMode;
        this.isReordering = true;
        this.initialOrderJson = JSON.stringify(this.wallets.map((w) => w.id));
      } else {
        this.finishReorder();
      }
    },

    moveWallet(index: number, direction: 'up' | 'down') {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= this.wallets.length) return;

      const updated = [...this.wallets];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      this.wallets = updated;
    },

    finishReorder() {
      const currentOrderJson = JSON.stringify(this.wallets.map((w) => w.id));

      if (currentOrderJson === this.initialOrderJson) {
        this.isReordering = false;
        this.viewMode = this.previousViewMode;
        return;
      }

      if (confirm('Simpan perubahan urutan dompet?')) {
        const orderIds = this.wallets.map((w) => w.id);
        localStorage.setItem(
          'studion_wallet_sort_order',
          JSON.stringify(orderIds)
        );
      } else {
        this.fetchAllData();
      }

      this.isReordering = false;
      this.viewMode = this.previousViewMode;
    },

    async fetchAllData() {
      this.loading = true;
      try {
        const [rawWallets, rawTransactions] = await Promise.all([
          apiClient.getWallets<WalletItem[]>(),
          apiClient.getTransactions<TransactionItem[]>(),
        ]);

        this.wallets = this.applyLocalStorageOrder(rawWallets);
        this.transactions = rawTransactions;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },

    getWalletBalance(wallet: WalletItem) {
      return calculateSingleWalletBalance(wallet, this.transactions);
    },

    get totalBalance() {
      const total = calculateTotalBalance(this.wallets, this.transactions);
      return formatCurrency(total);
    },

    getWalletTransactionCount(walletId: string) {
      if (!walletId) return 0;
      return this.transactions.filter(
        (t: TransactionItem) =>
          t.wallet_id === walletId || t.to_wallet_id === walletId
      ).length;
    },

    get topWallet() {
      if (!this.wallets.length) return null;
      return [...this.wallets].sort((a, b) => {
        return this.getWalletBalance(b) - this.getWalletBalance(a);
      })[0];
    },

    getWalletDetailStats(walletId: string) {
      if (!walletId) return { income: 0, expense: 0 };

      const now = new Date();
      const filteredTx = this.transactions.filter((t: TransactionItem) => {
        const isRelated =
          t.wallet_id === walletId || t.to_wallet_id === walletId;
        if (!isRelated) return false;

        if (this.detailStatsPeriod === 'all') return true;

        const txDate = new Date(t.transaction_date || t.created_at || now);
        const diffDays =
          (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);

        if (this.detailStatsPeriod === '1w') return diffDays <= 7;
        if (this.detailStatsPeriod === '1m') return diffDays <= 30;
        return true;
      });

      let income = 0;
      let expense = 0;

      filteredTx.forEach((t: TransactionItem) => {
        if (t.type === 'income' && t.wallet_id === walletId) {
          income += Number(t.amount);
        } else if (t.type === 'expense' && t.wallet_id === walletId) {
          expense += Number(t.amount);
        } else if (t.type === 'transfer') {
          if (t.to_wallet_id === walletId) income += Number(t.amount);
          if (t.wallet_id === walletId) expense += Number(t.amount);
        }
      });

      return { income, expense };
    },

    formatCurrency(val: number) {
      return formatCurrency(val);
    },

    showDetail(wallet: WalletItem) {
      this.selectedWallet = wallet;
      this.detailStatsPeriod = '1m';
      this.openDetailModal = true;
    },

    openAddModal() {
      this.isEdit = false;
      this.formData = {
        id: '',
        name: '',
        type: 'bank',
        balance: 0,
        color: '#2563eb',
        icon: 'landmark',
      };
      this.openFormModal = true;
    },

    openEditFromDetail() {
      this.isEdit = true;
      this.formData = { ...this.selectedWallet };
      this.openDetailModal = false;
      this.openFormModal = true;
    },

    async saveWallet() {
      if (!this.formData.name) return alert('Nama dompet harus diisi!');
      try {
        if (this.isEdit) {
          await apiClient.updateWallet(this.formData);
        } else {
          await apiClient.createWallet(this.formData);
        }
        this.openFormModal = false;
        this.fetchAllData();
      } catch (e: any) {
        alert(e.message || 'Gagal menyimpan dompet!');
      }
    },

    async deleteWalletFromDetail() {
      if (!confirm(`Yakin mau hapus ${this.selectedWallet.name}?`)) return;
      try {
        await apiClient.deleteWallet(this.selectedWallet.id);
        this.openDetailModal = false;
        this.fetchAllData();
      } catch (e: any) {
        alert(e.message || 'Gagal menghapus dompet!');
      }
    },
  };
}
