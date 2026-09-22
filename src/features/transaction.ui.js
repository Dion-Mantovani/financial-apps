// src/features/transaction.ui.js

/**
 * Controller UI untuk Manajemen Form & Input Transaksi (Alpine.js Component)
 * Menangani mode input (Expense, Income, Transfer), auto-suggest kategori,
 * quick-frequent transaction, form validation, dan aksi simpan/hapus.
 *
 * @returns {Object} Alpine Component Object
 */
export function transactionUI() {
  return {
    // ==========================================
    // 1. STATE & MODAL CONTROLLERS
    // ==========================================
    isEditMode: false,
    editingTransactionId: null,
    isSubmitting: false,

    // Modal / Sheet Visibility States
    showWalletModal: false,
    showCategoryModal: false,
    walletSheetTarget: 'source', // 'source' | 'target'
    autoCategoryDetected: false,

    // Amount & Fee Formatted Inputs
    formattedAmount: '',
    rawAmount: 0,
    formattedFee: '',
    rawFee: 0,

    // Feedback Alert States
    successMessage: '',
    successTimeout: null,
    errorMessage: '',

    // Validation Errors State
    errors: {
      amount: '',
      account_id: '',
      category_id: '',
      to_account_id: '',
      transaction_date: '',
    },

    // Main Form Data
    formData: {
      type: 'expense', // 'expense' | 'income' | 'transfer'
      transaction_date: new Date().toISOString().split('T')[0],
      account_id: '',
      to_account_id: '',
      category_id: '',
      fee: null,
      description: '',
    },

    // ==========================================
    // 2. LIFECYCLE HOOKS
    // ==========================================
    /**
     * Memuat data akun, kategori, dan transaksi dari Alpine Store.
     * Mengecek parameter URL untuk mode Edit atau pre-fill tipe transaksi.
     */
    async init() {
      this.errorMessage = '';

      const accStore = Alpine.store('account');
      const catStore = Alpine.store('category');
      const txStore = Alpine.store('transaction');

      await Promise.all([
        accStore.loadAccounts(),
        catStore.loadCategories(),
        txStore.loadTransactions(),
      ]);

      const params = new URLSearchParams(window.location.search);
      const transactionId = params.get('id');

      if (transactionId && txStore) {
        const transaction = txStore.transactions.find(
          (tx) => tx.id === transactionId
        );

        if (transaction) {
          this.editingTransactionId = transaction.id;
          this.isEditMode = true;

          this.formData.type = transaction.type;
          this.formData.transaction_date = transaction.transaction_date;
          this.formData.account_id = transaction.account_id || '';
          this.formData.to_account_id = transaction.to_account_id || '';
          this.formData.category_id = transaction.category_id || '';
          this.formData.description = transaction.description || '';

          this.rawAmount = Number(transaction.amount || 0);
          this.formattedAmount = this.rawAmount
            ? this.rawAmount.toLocaleString('id-ID')
            : '';

          this.rawFee = Number(transaction.fee || 0);
          this.formattedFee = this.rawFee
            ? this.rawFee.toLocaleString('id-ID')
            : '';
        }
      } else {
        if (params.get('type') === 'transfer') {
          this.formData.type = 'transfer';
        }

        if (!this.formData.account_id && this.activeAccounts.length) {
          this.formData.account_id = this.activeAccounts[0].id;
        }

        this.syncDefaultCategory();
      }

      this.$nextTick(() => {
        this.$refs.amountInput?.focus();
      });
    },

    // ==========================================
    // 3. GETTERS (COMPUTED PROPERTIES)
    // ==========================================
    /**
     * Mengambil 4 transaksi terbanyak/sering dilakukan untuk Quick Input.
     */
    get frequentTransactions() {
      const transactions = Alpine.store('transaction').transactions || [];

      if (!transactions.length) {
        return [
          {
            title: 'Parkir',
            amount: 2000,
            type: 'expense',
            category_id: 'e82239ae-596c-43b5-8479-41da8302c2f7',
            count: 0,
          },
        ];
      }

      const grouped = new Map();

      transactions.forEach((tx) => {
        if (tx.type === 'transfer') return;

        const description = (tx.description || '').trim();
        if (!description) return;

        const key = [
          tx.type,
          tx.category_id || '',
          description.toLowerCase(),
        ].join('|');

        if (!grouped.has(key)) {
          grouped.set(key, {
            title: description,
            amount: Number(tx.amount || 0),
            type: tx.type,
            category_id: tx.category_id || '',
            count: 0,
            latestDate: tx.transaction_date,
          });
        }

        const item = grouped.get(key);
        item.count += 1;

        if (!item.latestDate || tx.transaction_date >= item.latestDate) {
          item.amount = Number(tx.amount || 0);
          item.latestDate = tx.transaction_date;
        }
      });

      return [...grouped.values()]
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.latestDate.localeCompare(a.latestDate);
        })
        .slice(0, 4);
    },

    /**
     * Memfilter akun/dompet yang berstatus aktif.
     */
    get activeAccounts() {
      const accounts = Alpine.store('account').accounts || [];
      return accounts.filter((acc) => acc.status !== 'inactive');
    },

    /**
     * Mendapatkan objek dompet asal/sumber yang terpilih.
     */
    get selectedAccount() {
      return this.activeAccounts.find(
        (account) => account.id === this.formData.account_id
      );
    },

    /**
     * Mendapatkan objek dompet tujuan yang terpilih (khusus Transfer).
     */
    get selectedToAccount() {
      return this.activeAccounts.find(
        (account) => account.id === this.formData.to_account_id
      );
    },

    get expenseCategories() {
      const categories = Alpine.store('category').categories || [];
      return categories.filter((cat) => cat.type === 'expense');
    },

    get incomeCategories() {
      const categories = Alpine.store('category').categories || [];
      return categories.filter((cat) => cat.type === 'income');
    },

    /**
     * Memfilter kategori berdasarkan tipe transaksi yang aktif ('expense' / 'income').
     */
    get filteredCategories() {
      if (this.formData.type === 'expense') return this.expenseCategories;
      if (this.formData.type === 'income') return this.incomeCategories;
      return [];
    },

    /**
     * Daftar akun tujuan transfer (memunculkan semua akun aktif kecuali akun sumber).
     */
    get availableToAccounts() {
      return this.activeAccounts.filter(
        (account) => account.id !== this.formData.account_id
      );
    },

    get selectedAccountName() {
      return this.selectedAccount?.name || 'Pilih Akun';
    },

    get selectedToAccountName() {
      return this.selectedToAccount?.name || 'Pilih Akun Tujuan';
    },

    get selectedCategoryName() {
      const category = this.filteredCategories.find(
        (category) => category.id === this.formData.category_id
      );
      return category ? category.name : 'Pilih Kategori';
    },

    get formattedAmountPreview() {
      return this.rawAmount ? this.rawAmount.toLocaleString('id-ID') : '';
    },

    get formattedFeePreview() {
      return this.rawFee ? this.rawFee.toLocaleString('id-ID') : '';
    },

    // ==========================================
    // 4. FORM & AUTO-SUGGEST LOGIC
    // ==========================================
    /**
     * Format realtime input nominal utama.
     */
    handleAmountInput(event) {
      const value = event.target.value.replace(/[^0-9]/g, '');
      this.rawAmount = value ? parseInt(value, 10) : 0;
      this.formattedAmount = this.rawAmount
        ? this.rawAmount.toLocaleString('id-ID')
        : '';
      this.clearErrors();
    },

    /**
     * Format realtime input biaya admin/transfer.
     */
    handleFeeInput(event) {
      const value = event.target.value.replace(/[^0-9]/g, '');
      this.rawFee = value ? parseInt(value, 10) : 0;
      this.formattedFee = this.rawFee
        ? this.rawFee.toLocaleString('id-ID')
        : '';
      this.clearErrors();
    },

    /**
     * Memasukkan data transaksi dari item Frequent/Quick Transaction.
     */
    applyQuickData(item) {
      this.formData.type = item.type;
      this.rawAmount = parseInt(item.amount, 10);
      this.formattedAmount = this.rawAmount.toLocaleString('id-ID');
      this.formData.description = item.title;
      this.formData.category_id = item.category_id || '';
      this.autoCategoryDetected = false;
      this.clearErrors();
    },

    /**
     * Mendeteksi otomatis kategori berdasarkan riwayat deskripsi transaksi sebelumnya.
     */
    handleDescriptionInput() {
      if (this.formData.type === 'transfer') {
        this.autoCategoryDetected = false;
        return;
      }

      const description = this.formData.description.trim();
      if (!description) {
        this.autoCategoryDetected = false;
        return;
      }

      const transactions = Alpine.store('transaction').transactions || [];

      const pastTx = transactions.find(
        (tx) =>
          tx.type === this.formData.type &&
          tx.description &&
          tx.description.toLowerCase().includes(description.toLowerCase()) &&
          tx.category_id
      );

      const suggestedCategory = pastTx ? pastTx.category_id : null;

      if (!suggestedCategory) {
        this.autoCategoryDetected = false;
        return;
      }

      const categoryExists = this.filteredCategories.some(
        (category) => category.id === suggestedCategory
      );

      if (!categoryExists) {
        this.autoCategoryDetected = false;
        return;
      }

      this.formData.category_id = suggestedCategory;
      this.autoCategoryDetected = true;
    },

    /**
     * Menyeimbangkan/mengeset kategori default saat mengganti tipe transaksi.
     */
    syncDefaultCategory() {
      if (this.formData.type === 'transfer') {
        this.formData.category_id = '';
        this.autoCategoryDetected = false;
        return;
      }

      const categories = this.filteredCategories;
      const currentExists = categories.some(
        (category) => category.id === this.formData.category_id
      );

      if (!currentExists) {
        this.formData.category_id = categories.length ? categories[0].id : '';
      }
    },

    /**
     * Mengubah tipe transaksi (Expense / Income / Transfer) dan me-reset state terkait.
     */
    changeTransactionType(type) {
      this.formData.type = type;
      this.formData.category_id = '';
      this.formData.to_account_id = '';
      this.rawFee = 0;
      this.formattedFee = '';
      this.autoCategoryDetected = false;

      this.syncDefaultCategory();
      this.clearErrors();
    },

    // ==========================================
    // 5. MODAL & SHEET CONTROLLERS
    // ==========================================
    openWalletSheet(target) {
      this.walletSheetTarget = target;
      this.showWalletModal = true;
    },

    selectAccount(id) {
      if (this.walletSheetTarget === 'source') {
        this.formData.account_id = id;
        if (this.formData.to_account_id === id) {
          this.formData.to_account_id = '';
        }
      } else {
        this.formData.to_account_id = id;
      }
      this.showWalletModal = false;
    },

    openCategoryModal() {
      if (!this.filteredCategories.length) {
        alert('Belum ada kategori untuk tipe transaksi ini.');
        return;
      }
      this.showCategoryModal = true;
    },

    selectCategory(id) {
      this.formData.category_id = id;
      this.autoCategoryDetected = false;
      this.showCategoryModal = false;
    },

    showSuccessMessage(message) {
      this.successMessage = message;
      clearTimeout(this.successTimeout);

      this.successTimeout = setTimeout(() => {
        this.successMessage = '';
      }, 3000);
    },

    clearErrors() {
      this.errors = {
        amount: '',
        account_id: '',
        category_id: '',
        to_account_id: '',
        transaction_date: '',
      };
    },

    /**
     * Validasi kelayakan input data transaksi sebelum disimpan.
     *
     * @returns {boolean} True jika valid
     */
    validateForm() {
      this.clearErrors();
      let valid = true;

      if (!this.rawAmount || this.rawAmount <= 0) {
        this.errors.amount = 'Nominal harus lebih dari 0.';
        valid = false;
      }

      if (!this.formData.account_id) {
        this.errors.account_id = 'Pilih wallet.';
        valid = false;
      }

      if (this.formData.type === 'transfer') {
        if (!this.formData.to_account_id) {
          this.errors.to_account_id = 'Pilih wallet tujuan.';
          valid = false;
        } else if (this.formData.to_account_id === this.formData.account_id) {
          this.errors.to_account_id =
            'Wallet tujuan tidak boleh sama dengan wallet sumber.';
          valid = false;
        }
      } else {
        if (!this.formData.category_id) {
          this.errors.category_id = 'Pilih kategori.';
          valid = false;
        }
      }

      if (!this.formData.transaction_date) {
        this.errors.transaction_date = 'Pilih tanggal transaksi.';
        valid = false;
      }

      return valid;
    },

    // ==========================================
    // 6. CRUD ACTIONS & HANDLERS
    // ==========================================
    /**
     * Menyimpan transaksi (Tambah Baru atau Update) lalu redirect ke halaman History.
     */
    async saveTransaction() {
      if (!this.validateForm()) return;
      this.isSubmitting = true;

      try {
        const payload = {
          ...this.formData,
          amount: this.rawAmount,
          fee: this.rawFee || 0,
        };

        const txStore = Alpine.store('transaction');

        if (this.isEditMode) {
          // DIUBAH: Memanggil updateTransaction alih-alih delete & add
          await txStore.updateTransaction(this.editingTransactionId, payload);
        } else {
          await txStore.addTransaction(payload);
        }

        window.location.href = '/history';
      } catch (error) {
        console.error('Gagal menyimpan transaksi:', error);
      } finally {
        this.isSubmitting = false;
      }
    },

    /**
     * Menyimpan transaksi lalu me-reset form agar pengguna bisa menambah transaksi lain.
     */
    async saveAndAddTransaction() {
      if (!this.validateForm()) return;
      this.isSubmitting = true;

      try {
        const payload = {
          ...this.formData,
          amount: this.rawAmount,
          fee: this.rawFee || 0,
        };

        await Alpine.store('transaction').addTransaction(payload);

        this.formattedAmount = '';
        this.rawAmount = 0;
        this.formData.category_id = '';
        this.formData.description = '';
        this.autoCategoryDetected = false;

        this.showSuccessMessage('Transaksi berhasil disimpan.');
      } catch (error) {
        console.error('Gagal menyimpan transaksi:', error);
      } finally {
        this.isSubmitting = false;
      }
    },

    /**
     * Menghapus transaksi yang sedang diedit.
     */
    async deleteTransaction() {
      if (!this.editingTransactionId) return;

      const confirmed = window.confirm(
        'Hapus transaksi ini? Data transaksi tidak dapat dipulihkan.'
      );
      if (!confirmed) return;

      this.isSubmitting = true;

      try {
        await Alpine.store('transaction').deleteTransaction(
          this.editingTransactionId
        );
        window.location.href = '/history';
      } catch (error) {
        console.error('Gagal menghapus transaksi:', error);
      } finally {
        this.isSubmitting = false;
      }
    },
  };
}
