import { apiClient } from '../services/apiClient';
import { getTodayInputDate } from '../utils/formatters';
import { getCache, setCache } from '../utils/cache';
import type { WalletItem, CategoryItem, TransactionItem } from '../utils/types';

export function transactionController() {
  return {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    wallets: [] as WalletItem[],
    categories: [] as CategoryItem[],
    pastTransactions: [] as TransactionItem[],

    isSubmitting: false,
    isEditMode: false,
    transactionId: '',
    autoCategoryDetected: false,

    showWalletModal: false,
    showCategoryModal: false,
    walletSheetTarget: 'source' as 'source' | 'target',

    formData: {
      type: 'expense',
      amount: '',
      wallet_id: '',
      to_wallet_id: '',
      category_id: '',
      transaction_date: getTodayInputDate(),
      notes: '',
    },

    // ==========================================
    // 2. LIFECYCLE & SWR DATA FETCHING
    // ==========================================
    async init() {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('id');
      const typeParam = urlParams.get('type');

      if (typeParam && ['income', 'expense', 'transfer'].includes(typeParam)) {
        this.formData.type = typeParam;
      }

      // Step 1: Load instan dari Cache (0 ms delay)
      this.loadMasterDataFromCache();

      if (editId) {
        this.isEditMode = true;
        this.transactionId = editId;
      } else {
        setTimeout(() => {
          const input = document.querySelector(
            'input[x-ref="amountInput"]'
          ) as HTMLInputElement;
          input?.focus();
        }, 100);
      }

      // Step 2: Revalidate data dari Server di background
      await this.loadMasterData();

      if (this.isEditMode && editId) {
        await this.loadTransactionForEdit(editId);
      }

      // Watcher perubahan tipe transaksi & dompet utama
      (this as any).$watch('formData.type', (value: string) => {
        this.autoCategoryDetected = false;
        this.updateDefaultCategory();
        if (value === 'transfer') {
          this.updateDefaultToWallet();
        }
      });

      (this as any).$watch('formData.wallet_id', () => {
        if (this.formData.type === 'transfer') {
          this.updateDefaultToWallet();
        }
      });
    },

    loadMasterDataFromCache() {
      const cachedWallets = getCache<WalletItem[]>('studion_cache_wallets');
      const cachedCategories = getCache<CategoryItem[]>(
        'studion_cache_categories'
      );
      const cachedTransactions = getCache<TransactionItem[]>(
        'studion_cache_transactions'
      );

      if (cachedWallets) this.wallets = cachedWallets;
      if (cachedCategories) this.categories = cachedCategories;
      if (cachedTransactions) this.pastTransactions = cachedTransactions;

      if (this.wallets.length > 0 && !this.formData.wallet_id) {
        this.formData.wallet_id = this.wallets[0].id;
      }

      this.updateDefaultCategory();
      this.updateDefaultToWallet();
    },

    async loadMasterData() {
      try {
        const [rawWallets, rawCategories, rawTransactions] = await Promise.all([
          apiClient.getWallets<WalletItem[]>(),
          apiClient.getCategories<CategoryItem[]>(),
          apiClient.getTransactions<TransactionItem[]>(),
        ]);

        this.wallets = rawWallets;
        this.categories = rawCategories;
        this.pastTransactions = rawTransactions;

        setCache('studion_cache_wallets', rawWallets);
        setCache('studion_cache_categories', rawCategories);
        setCache('studion_cache_transactions', rawTransactions);

        if (this.wallets.length > 0 && !this.formData.wallet_id) {
          this.formData.wallet_id = this.wallets[0].id;
        }

        this.updateDefaultCategory();
        this.updateDefaultToWallet();
      } catch (e) {
        console.error('SWR Revalidate Transaction Master Data Failed:', e);
      }
    },

    async loadTransactionForEdit(id: string) {
      try {
        const target = this.pastTransactions.find((t: any) => t.id === id);

        if (target) {
          this.formData = {
            type: target.type || 'expense',
            amount: target.amount ? String(target.amount) : '',
            wallet_id: target.wallet_id || '',
            to_wallet_id: target.to_wallet_id || '',
            category_id: target.category_id || '',
            transaction_date: target.transaction_date
              ? target.transaction_date.split('T')[0]
              : getTodayInputDate(),
            notes: target.notes || '',
          };
        }
      } catch (e) {
        console.error('Gagal memuat data transaksi edit:', e);
      }
    },

    // ==========================================
    // 3. COMPUTED / GETTERS
    // ==========================================
    get formattedAmount() {
      if (!this.formData.amount) return '';
      const num = parseInt(this.formData.amount, 10);
      if (isNaN(num)) return '';
      return new Intl.NumberFormat('id-ID').format(num);
    },

    get selectedWalletName() {
      const w = this.wallets.find(
        (item) => item.id === this.formData.wallet_id
      );
      return w ? w.name : 'Pilih Dompet';
    },

    get selectedToWalletName() {
      const w = this.wallets.find(
        (item) => item.id === this.formData.to_wallet_id
      );
      return w ? w.name : 'Pilih Tujuan';
    },

    get selectedCategoryName() {
      const c = this.categories.find(
        (item) => item.id === this.formData.category_id
      );
      return c ? c.name : 'Pilih Kategori';
    },

    get filteredCategories() {
      return this.categories.filter(
        (c: CategoryItem) => c.type === this.formData.type
      );
    },

    get availableToWallets() {
      return this.wallets.filter(
        (w: WalletItem) => w.id !== this.formData.wallet_id
      );
    },

    get frequentTransactions() {
      if (!this.pastTransactions || this.pastTransactions.length === 0)
        return [];

      const counts: Record<
        string,
        {
          title: string;
          amount: string;
          type: string;
          category_id: string;
          category_icon: string;
          count: number;
          lastDate: string;
        }
      > = {};

      this.pastTransactions.forEach((tx) => {
        if (!tx.notes || tx.type === 'transfer') return;

        const key = `${tx.notes.trim().toLowerCase()}_${tx.amount}`;
        const matchedCat = this.categories.find((c) => c.id === tx.category_id);
        const catIcon = matchedCat ? matchedCat.icon : '';

        if (!counts[key]) {
          counts[key] = {
            title: tx.notes.trim(),
            amount: String(tx.amount),
            type: tx.type || 'expense',
            category_id: tx.category_id || '',
            category_icon: catIcon || '',
            count: 1,
            lastDate: tx.transaction_date || tx.created_at || '',
          };
        } else {
          counts[key].count += 1;
          if (
            (tx.transaction_date || tx.created_at || '') > counts[key].lastDate
          ) {
            counts[key].lastDate = tx.transaction_date || tx.created_at || '';
          }
        }
      });

      return Object.values(counts)
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return (
            new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
          );
        })
        .slice(0, 5);
    },

    // ==========================================
    // 4. UI HANDLERS & FORM LOGIC
    // ==========================================
    handleAmountInput(event: any) {
      const rawValue = event.target.value.replace(/[^0-9]/g, '');
      this.formData.amount = rawValue;
      event.target.value = this.formattedAmount;
    },

    openWalletSheet(target: 'source' | 'target') {
      this.walletSheetTarget = target;
      this.showWalletModal = false;
      setTimeout(() => {
        this.showWalletModal = true;
      }, 10);
    },

    selectWallet(id: string) {
      if (this.walletSheetTarget === 'source') {
        this.formData.wallet_id = id;
      } else {
        this.formData.to_wallet_id = id;
      }
      this.showWalletModal = false;
    },

    handleNotesInput() {
      if (this.isEditMode || this.formData.type === 'transfer') return;

      const inputNote = this.formData.notes.trim().toLowerCase();
      if (inputNote.length < 2) {
        this.autoCategoryDetected = false;
        return;
      }

      const matchedTx = this.pastTransactions.find((tx) => {
        if (!tx.notes) return false;
        const txNote = tx.notes.trim().toLowerCase();
        return txNote.includes(inputNote) || inputNote.includes(txNote);
      });

      if (matchedTx) {
        const targetCategoryId =
          matchedTx.category_id ||
          (matchedTx.categories ? matchedTx.categories.id : null);

        if (targetCategoryId) {
          const matchedCategory = this.filteredCategories.find(
            (c) => String(c.id) === String(targetCategoryId)
          );

          if (matchedCategory) {
            this.formData.category_id = matchedCategory.id;
            this.autoCategoryDetected = true;
            return;
          }
        }
      }

      this.autoCategoryDetected = false;
    },

    updateDefaultToWallet() {
      const available = this.availableToWallets;
      if (available.length > 0) {
        if (
          !this.formData.to_wallet_id ||
          this.formData.to_wallet_id === this.formData.wallet_id
        ) {
          this.formData.to_wallet_id = available[0].id;
        }
      } else {
        this.formData.to_wallet_id = '';
      }
    },

    updateDefaultCategory() {
      const available = this.filteredCategories;
      if (available.length > 0) {
        if (this.formData.type === 'transfer') {
          const transferCat = available.find((c: CategoryItem) =>
            c.name.toLowerCase().includes('transfer')
          );
          this.formData.category_id = transferCat
            ? transferCat.id
            : available[0].id;
        } else if (
          !this.formData.category_id ||
          !available.some((c) => c.id === this.formData.category_id)
        ) {
          this.formData.category_id = available[0].id;
        }
      } else {
        this.formData.category_id = '';
      }
    },

    applyQuickData(item: any) {
      this.formData.type = item.type || 'expense';
      this.formData.amount = String(item.amount).replace(/[^0-9]/g, '');
      this.formData.notes = item.title;

      if (item.category_id) {
        this.formData.category_id = item.category_id;
        this.autoCategoryDetected = true;
      } else {
        this.handleNotesInput();
      }
    },

    // ==========================================
    // 5. API ACTIONS (SAVE & DELETE)
    // ==========================================
    async saveTransaction(addAnother = false) {
      if (!this.formData.amount || Number(this.formData.amount) <= 0) {
        return alert('Nominal transaksi harus diisi!');
      }
      if (!this.formData.wallet_id) {
        return alert('Pilih dompet terlebih dahulu!');
      }

      let payloadNotes = this.formData.notes.trim();
      if (!payloadNotes) {
        if (this.formData.type === 'transfer') {
          payloadNotes = 'Transfer Antar Dompet';
        } else {
          const selectedCat = this.categories.find(
            (c: CategoryItem) => c.id === this.formData.category_id
          );
          payloadNotes = selectedCat ? selectedCat.name : 'Transaksi';
        }
      }

      const payload = {
        ...this.formData,
        id: this.transactionId || undefined,
        notes: payloadNotes,
      };

      this.isSubmitting = true;

      try {
        if (this.isEditMode) {
          await apiClient.updateTransaction(payload);
        } else {
          await apiClient.createTransaction(payload);
        }

        if (addAnother && !this.isEditMode) {
          this.formData.amount = '';
          this.formData.notes = '';
          this.autoCategoryDetected = false;
          setTimeout(() => {
            const input = document.querySelector(
              'input[x-ref="amountInput"]'
            ) as HTMLInputElement;
            input?.focus();
          }, 100);
          alert('Transaksi berhasil disimpan! Silakan tambah lagi.');
        } else {
          window.location.href = '/history';
        }
      } catch (e: any) {
        console.error(e);
        alert(
          'Gagal menyimpan transaksi: ' + (e.message || 'Terjadi kesalahan')
        );
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteTransaction() {
      if (!confirm('Yakin ingin menghapus transaksi ini?')) return;

      this.isSubmitting = true;
      try {
        await apiClient.deleteTransaction(this.transactionId);
        window.location.href = '/history';
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Gagal menghapus transaksi!');
      } finally {
        this.isSubmitting = false;
      }
    },
  };
}
