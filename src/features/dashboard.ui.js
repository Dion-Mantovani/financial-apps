// src/features/dashboard.ui.js
import Alpine from 'alpinejs';

export function dashboardUI() {
  return {
    /*
     * ==========================================
     * 1. STATE & COMPONENT UI PROPS
     * ==========================================
     */
    hideBalance: false,
    showDetails: false,
    openCustomQuickModal: false,
    openManageQuickModal: false,

    showToast: false,
    toastMessage: '',

    // Form Catat Cepat Custom
    quickName: '',
    quickAmount: '',
    quickCategoryId: '',
    quickAccountId: '',
    quickToAccountId: '', // Akun tujuan transfer
    quickFee: 0, // Biaya admin transfer
    quickType: 'expense', // 'expense', 'income', atau 'transfer'

    // List local frequent transactions
    frequentTransactions: [],

    // Master fitur menu navigasi
    allFeatures: [
      { id: 'account', label: 'Dompet', icon: 'wallet', href: '/account' },
      { id: 'categories', label: 'Kategori', icon: 'grid', href: '/category' },
      { id: 'goals', label: 'Impian', icon: 'target', href: '/goals' },
      { id: 'debts', label: 'Utang', icon: 'receipt', href: '/debts' },
      {
        id: 'subscriptions',
        label: 'Langganan',
        icon: 'repeat',
        href: '/subscriptions',
      },
      { id: 'bills', label: 'Tagihan', icon: 'credit-card', href: '/bills' },
    ],

    /*
     * ==========================================
     * 2. LIFECYCLE HOOKS
     * ==========================================
     */
    async init() {
      await Promise.all([
        Alpine.store('account').loadAccounts(),
        Alpine.store('category').loadCategories(),
        Alpine.store('transaction').loadTransactions(),
      ]);

      this.loadFrequentTransactions();

      if (this.wallets.length > 0 && !this.quickAccountId) {
        this.quickAccountId = this.wallets[0].id;
      }
      if (this.wallets.length > 1 && !this.quickToAccountId) {
        this.quickToAccountId = this.wallets[1].id;
      }

      const defaultCat = this.activeCategories[0];
      if (defaultCat && !this.quickCategoryId) {
        this.quickCategoryId = defaultCat.id;
      }
    },

    /*
     * ==========================================
     * 3. DATA ACCESSORS (GLOBAL STORES)
     * ==========================================
     */
    get wallets() {
      return Alpine.store('account')?.accounts || [];
    },

    get categories() {
      return Alpine.store('category')?.categories || [];
    },

    get transactions() {
      return Alpine.store('transaction')?.transactions || [];
    },

    /** Kategori disesuaikan dengan tipe transaksi (khusus expense/income) */
    get activeCategories() {
      return this.categories.filter((c) => c.type === this.quickType);
    },

    loadFrequentTransactions() {
      const saved = localStorage.getItem('custom_quick_transactions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.frequentTransactions = parsed;
            return;
          }
        } catch (e) {
          console.error('Gagal parse custom quick transactions:', e);
        }
      }

      // Default item siap pakai
      this.frequentTransactions = [
        {
          id: 'def-1',
          title: 'Kopi Kenangan',
          amount: 25000,
          type: 'expense',
          category_id: '',
          account_id: '',
          to_account_id: null,
          fee: 0,
        },
        {
          id: 'def-2',
          title: 'Transfer ke BCA',
          amount: 100000,
          type: 'transfer',
          category_id: null,
          account_id: '',
          to_account_id: '',
          fee: 0,
        },
      ];
    },

    /*
     * ==========================================
     * 4. STATISTICAL & COMPUTED GETTERS
     * ==========================================
     */
    get totalBalance() {
      const initialTotal = this.wallets.reduce(
        (sum, acc) => sum + Number(acc.initial_balance || 0),
        0
      );

      const cashFlow = this.transactions.reduce((sum, tx) => {
        const amount = Number(tx.amount || 0);
        const fee = Number(tx.fee || 0);

        if (tx.type === 'income') return sum + amount;
        if (tx.type === 'expense') return sum - amount;
        if (tx.type === 'transfer') return sum - fee; // Transfer murni tidak mengubah total netto global kecuali biaya admin
        return sum;
      }, 0);

      return initialTotal + cashFlow;
    },

    get monthlyIncome() {
      const currentMonth = new Date().toISOString().slice(0, 7);
      return this.transactions
        .filter(
          (tx) =>
            tx.type === 'income' &&
            tx.transaction_date &&
            tx.transaction_date.startsWith(currentMonth)
        )
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    },

    get monthlyExpense() {
      const currentMonth = new Date().toISOString().slice(0, 7);
      return this.transactions
        .filter(
          (tx) =>
            (tx.type === 'expense' || tx.type === 'transfer') &&
            tx.transaction_date &&
            tx.transaction_date.startsWith(currentMonth)
        )
        .reduce(
          (sum, tx) => sum + Number(tx.amount || 0) + Number(tx.fee || 0),
          0
        );
    },

    get recentTransactions() {
      const walletMap = new Map(this.wallets.map((w) => [w.id, w.name]));
      // Buat Map lengkap untuk kategori (nama dan icon-nya sekaligus)
      const categoryMap = new Map(
        this.categories.map((c) => [c.id, { name: c.name, icon: c.icon }])
      );

      const sortedTxs = [...this.transactions].sort((a, b) => {
        const dateA = new Date(
          `${a.transaction_date || ''}T${a.created_at ? a.created_at.split('T')[1] : '00:00:00'}`
        );
        const dateB = new Date(
          `${b.transaction_date || ''}T${b.created_at ? b.created_at.split('T')[1] : '00:00:00'}`
        );
        return dateB - dateA;
      });

      return sortedTxs.slice(0, 5).map((tx) => {
        const walletName = walletMap.get(tx.account_id) || 'Akun Utama';
        const toWalletName = walletMap.get(tx.to_account_id) || '';

        // Ambil data kategori berdasarkan ID
        const categoryData = categoryMap.get(tx.category_id) || {
          name: 'Umum',
          icon: 'folder',
        };
        const categoryName = categoryData.name;

        let displayTitle = tx.description;
        let displaySubtitle = `${categoryName} • ${walletName}`;
        let iconType = categoryData.icon || 'utensils'; // Ambil icon dari kategori, fallback ke utensils

        if (tx.type === 'income') {
          iconType = 'wallet'; // Pemasukan default wallet
          displaySubtitle = `Pemasukan • ${walletName}`;
        } else if (tx.type === 'transfer') {
          iconType = 'repeat'; // Transfer pakai icon repeat
          displayTitle = tx.description || `Transfer ke ${toWalletName}`;
          displaySubtitle = `Transfer • ${walletName} ➔ ${toWalletName}`;
        } else {
          displayTitle = tx.description || categoryName;
        }

        return {
          id: tx.id,
          title: displayTitle,
          subtitle: displaySubtitle,
          amount: tx.amount,
          type: tx.type,
          icon: iconType, // Icon sekarang dinamis dari kategori/tipe transaksi!
        };
      });
    },

    /*
     * ==========================================
     * 5. ACTIONS (SYNC & TRANSACTIONS)
     * ==========================================
     */
    async sync() {
      try {
        const success = await Alpine.store('app').triggerSync();
        if (success) {
          this.triggerToast('Sinkronisasi selesai!');
          await new Promise((resolve) => setTimeout(resolve, 800));
          window.location.reload();
        }
      } catch (err) {
        console.error('[Dashboard UI] Sync Error:', err);
        this.triggerToast('Gagal melakukan sinkronisasi.');
      }
    },

    async quickAddTransaction(
      title,
      amount,
      type,
      categoryId,
      accountId,
      toAccountId,
      fee
    ) {
      if (!this.wallets || this.wallets.length === 0) {
        this.triggerToast('Buat akun/dompet terlebih dahulu!');
        return;
      }

      const targetAccountId = accountId || this.wallets[0].id;
      const txType = type || 'expense';
      let targetToAccountId = toAccountId || null;
      let targetCategoryId = categoryId || null;

      if (txType === 'transfer') {
        targetToAccountId =
          toAccountId ||
          (this.wallets[1] ? this.wallets[1].id : targetAccountId);
      } else if (!targetCategoryId) {
        const matchingCat = this.categories.find((c) => c.type === txType);
        if (matchingCat) targetCategoryId = matchingCat.id;
      }

      try {
        await Alpine.store('transaction').addTransaction({
          amount: Number(amount),
          description: title,
          account_id: targetAccountId,
          to_account_id: targetToAccountId,
          category_id: targetCategoryId,
          fee: Number(fee || 0),
          type: txType,
        });

        this.triggerToast(`Tercatat: ${title}`);
      } catch (err) {
        console.error('[Dashboard UI] Gagal catat cepat:', err);
        this.triggerToast('Gagal mencatat transaksi');
      }
    },

    async saveCustomQuick() {
      if (!this.quickName || !this.quickAmount) {
        this.triggerToast('Isi nama dan nominal transaksi!');
        return;
      }

      const newItem = {
        id: 'custom-' + Date.now(),
        title: this.quickName,
        amount: Number(this.quickAmount),
        type: this.quickType,
        category_id:
          this.quickType === 'transfer'
            ? null
            : this.quickCategoryId || this.activeCategories[0]?.id || '',
        account_id: this.quickAccountId || this.wallets[0]?.id || '',
        to_account_id:
          this.quickType === 'transfer' ? this.quickToAccountId : null,
        fee: Number(this.quickFee || 0),
      };

      this.frequentTransactions.unshift(newItem);
      if (this.frequentTransactions.length > 5) {
        this.frequentTransactions = this.frequentTransactions.slice(0, 5);
      }

      localStorage.setItem(
        'custom_quick_transactions',
        JSON.stringify(this.frequentTransactions)
      );

      await this.quickAddTransaction(
        newItem.title,
        newItem.amount,
        newItem.type,
        newItem.category_id,
        newItem.account_id,
        newItem.to_account_id,
        newItem.fee
      );

      this.quickName = '';
      this.quickAmount = '';
      this.quickFee = 0;
      this.openCustomQuickModal = false;
    },

    deleteQuickItem(index) {
      this.frequentTransactions.splice(index, 1);
      localStorage.setItem(
        'custom_quick_transactions',
        JSON.stringify(this.frequentTransactions)
      );
      this.triggerToast('Item catat cepat dihapus');
    },

    /*
     * ==========================================
     * 6. UI HELPERS
     * ==========================================
     */
    triggerToast(msg) {
      this.toastMessage = msg;
      this.showToast = true;
      setTimeout(() => {
        this.showToast = false;
      }, 2500);
    },

    formatRupiah(val) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(val || 0);
    },
  };
}
