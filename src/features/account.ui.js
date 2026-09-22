// src/features/account.ui.js

/**
 * Controller UI untuk Manajemen Dompet / Akun (Alpine.js Component)
 * Menangani state modal, form input, reordering, format saldo, dan kalkulasi realtime.
 *
 * @returns {Object} Alpine Component Object
 */
export function accountUI() {
  return {
    // ==========================================
    // 1. STATE & MODAL CONTROLLERS
    // ==========================================
    isReordering: false,
    walletOrder: [],
    originalWalletOrder: [],

    // Modal Visibility States
    openDetailModal: false,
    openFormModal: false,
    openCorrectionModal: false,
    openDeleteWarningModal: false,
    openDeleteConfirmModal: false,

    // Form & Delete States
    deleteConfirmName: '',
    isEdit: false,
    selectedWallet: {},
    formData: {
      id: null,
      name: '',
      icon: 'landmark',
      initial_balance: 0,
    },

    // Form Formatting & Correction Balance States
    formattedBalance: '',
    rawBalance: 0,
    newCorrectionBalance: 0,

    // Master pilihan ikon dompet
    availableIcons: [
      { id: 'landmark', name: 'Bank Utama' },
      { id: 'building', name: 'Bank Cabang' },
      { id: 'credit-card', name: 'Kartu Kredit' },
      { id: 'coins', name: 'Tunai / Cash' },
      { id: 'wallet', name: 'Dompet Fisik' },
      { id: 'piggy-bank', name: 'Celengan' },
      { id: 'qr-code', name: 'E-Wallet QR' },
      { id: 'briefcase', name: 'Gaji / Bisnis' },
    ],

    // ==========================================
    // 2. LIFECYCLE HOOKS
    // ==========================================
    /**
     * Inisialisasi data dompet dan transaksi dari Alpine Stores,
     * serta memuat urutan dompet kustom dari LocalStorage.
     */
    async init() {
      await Promise.all([
        Alpine.store('account').loadAccounts(),
        Alpine.store('transaction').loadTransactions(),
      ]);

      const savedOrder = JSON.parse(
        localStorage.getItem('wallet_order') || '[]'
      );
      if (savedOrder.length) {
        this.walletOrder = savedOrder;
      }
    },

    // ==========================================
    // 3. GETTERS (COMPUTED PROPERTIES)
    // ==========================================
    /**
     * Mengambil daftar dompet yang sudah diurutkan berdasarkan walletOrder.
     */
    get wallets() {
      const accounts = Alpine.store('account').accounts || [];
      if (!accounts.length) return [];
      if (!this.walletOrder.length) return accounts;

      const orderMap = new Map(
        this.walletOrder.map((id, index) => [id, index])
      );

      return [...accounts].sort((a, b) => {
        const indexA = orderMap.has(a.id)
          ? orderMap.get(a.id)
          : Number.MAX_SAFE_INTEGER;
        const indexB = orderMap.has(b.id)
          ? orderMap.get(b.id)
          : Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });
    },

    /**
     * Menghitung dan memformat total akumulasi seluruh saldo dompet.
     */
    get totalBalance() {
      const accounts = Alpine.store('account').accounts || [];
      const total = accounts.reduce((sum, acc) => {
        return sum + this.getAccountRealBalance(acc.id);
      }, 0);
      return this.formatCurrency(total);
    },

    /**
     * Mencari dompet dengan saldo real-time tertinggi.
     */
    get topWallet() {
      if (!this.wallets.length) return null;
      return [...this.wallets]
        .map((w) => ({
          ...w,
          realBalance: this.getAccountRealBalance(w.id),
        }))
        .sort((a, b) => b.realBalance - a.realBalance)[0];
    },

    // ==========================================
    // 4. FINANCIAL & CALCULATION LOGIC
    // ==========================================
    /**
     * Menghitung saldo real-time dompet berdasarkan transaksi (Income, Expense, Transfer).
     *
     * @param {string} walletId - ID dari dompet yang ingin dihitung
     * @returns {number} Nilai saldo real-time
     */
    getAccountRealBalance(walletId) {
      const accounts = Alpine.store('account').accounts || [];
      const wallet = accounts.find((a) => a.id === walletId);
      if (!wallet) return 0;

      let balance = Number(wallet.initial_balance) || 0;
      const txs = Alpine.store('transaction').transactions || [];

      txs.forEach((tx) => {
        const amount = Number(tx.amount) || 0;
        const fee = Number(tx.fee) || 0;

        if (tx.type === 'income' && tx.account_id === walletId) {
          balance += amount;
        }
        if (tx.type === 'expense' && tx.account_id === walletId) {
          balance -= amount;
        }
        if (tx.type === 'transfer') {
          if (tx.account_id === walletId) {
            balance -= amount + fee;
          }
          if (tx.to_account_id === walletId) {
            balance += amount;
          }
        }
      });

      return balance;
    },

    /**
     * Menghitung jumlah transaksi yang terikat dengan dompet tertentu.
     *
     * @param {string} id - ID dompet
     * @returns {number} Total jumlah transaksi
     */
    getWalletTransactionCount(id) {
      const txs = Alpine.store('transaction').transactions || [];
      return txs.filter((tx) => tx.account_id === id || tx.to_account_id === id)
        .length;
    },

    /**
     * Format angka ke format mata uang Rupiah (Rp X.XXX.XXX).
     *
     * @param {number} val - Nilai numerik
     * @returns {string} String terformat Rupiah
     */
    formatCurrency(val) {
      return 'Rp ' + (val || 0).toLocaleString('id-ID');
    },

    /**
     * Handler realtime input angka saldo pada form.
     *
     * @param {Event} event - Event dari input DOM
     */
    handleBalanceInput(event) {
      const value = event.target.value.replace(/[^0-9]/g, '');
      this.rawBalance = value ? parseInt(value, 10) : 0;
      this.formattedBalance = this.rawBalance
        ? this.rawBalance.toLocaleString('id-ID')
        : '';
    },

    // ==========================================
    // 5. REORDERING LOGIC
    // ==========================================
    /**
     * Toggle status mode pengurutan ulang dompet (Reorder Mode).
     */
    toggleReorderMode() {
      if (!this.isReordering) {
        this.originalWalletOrder = this.wallets.map((w) => w.id);
        this.walletOrder = [...this.originalWalletOrder];
        this.isReordering = true;
        return;
      }
      this.finishReorder();
    },

    /**
     * Menggeser posisi dompet ke atas atau ke bawah.
     *
     * @param {number} index - Indeks posisi dompet saat ini
     * @param {'up'|'down'} direction - Arah pergeseran
     */
    moveWallet(index, direction) {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= this.wallets.length) return;

      const newOrder = this.wallets.map((w) => w.id);
      [newOrder[index], newOrder[targetIndex]] = [
        newOrder[targetIndex],
        newOrder[index],
      ];
      this.walletOrder = newOrder;
    },

    /**
     * Menyelesaikan reorder dan menyimpan urutan baru ke LocalStorage jika ada perubahan.
     */
    finishReorder() {
      const currentOrder = this.wallets.map((w) => w.id);
      const hasChanged =
        JSON.stringify(currentOrder) !==
        JSON.stringify(this.originalWalletOrder);

      if (hasChanged) {
        localStorage.setItem('wallet_order', JSON.stringify(currentOrder));
      }

      this.originalWalletOrder = [];
      this.isReordering = false;
    },

    // ==========================================
    // 6. MODAL & FORM CONTROLLERS
    // ==========================================
    /**
     * Membuka modal detail dompet.
     */
    showDetail(wallet) {
      this.selectedWallet = wallet;
      this.openDetailModal = true;
    },

    /**
     * Membuka modal form tambah dompet baru.
     */
    openAddModal() {
      this.isEdit = false;
      this.formData = {
        id: null,
        name: '',
        icon: 'landmark',
        initial_balance: 0,
      };
      this.rawBalance = 0;
      this.formattedBalance = '';
      this.openFormModal = true;

      this.$nextTick(() => {
        this.$refs.accountNameInput?.focus();
      });
    },

    /**
     * Membuka modal form edit dompet yang diambil dari modal detail.
     */
    openEditFromDetail() {
      this.isEdit = true;
      const currentBalance = this.getAccountRealBalance(this.selectedWallet.id);

      this.formData = {
        id: this.selectedWallet.id,
        name: this.selectedWallet.name,
        icon: this.selectedWallet.icon,
      };

      this.rawBalance = currentBalance;
      this.formattedBalance = currentBalance
        ? currentBalance.toLocaleString('id-ID')
        : '';

      this.openDetailModal = false;
      this.openFormModal = true;
    },

    // ==========================================
    // 7. CRUD ACTIONS & HANDLERS
    // ==========================================
    /**
     * Menyimpan dompet baru atau memperbarui dompet yang ada.
     */
    async saveWallet() {
      if (!this.formData.name.trim()) return;

      const targetBalance = this.rawBalance;

      if (this.isEdit) {
        const txCount = this.getWalletTransactionCount(this.formData.id);
        const currentBalance = this.getAccountRealBalance(this.formData.id);

        // Jika dompet memiliki transaksi dan terjadi selisih saldo, lempar ke Modal Koreksi
        if (txCount > 0 && targetBalance !== currentBalance) {
          this.newCorrectionBalance = targetBalance;
          this.openFormModal = false;
          this.openCorrectionModal = true;
          return;
        }

        await Alpine.store('account').updateAccount(this.formData.id, {
          name: this.formData.name.trim(),
          icon: this.formData.icon,
          initial_balance: targetBalance,
        });
      } else {
        const newAcc = await Alpine.store('account').addAccount({
          name: this.formData.name.trim(),
          icon: this.formData.icon,
          initial_balance: targetBalance,
        });

        if (newAcc) {
          this.walletOrder = [
            newAcc.id,
            ...this.walletOrder.filter((id) => id !== newAcc.id),
          ];
          localStorage.setItem(
            'wallet_order',
            JSON.stringify(this.walletOrder)
          );
        }
      }

      this.openFormModal = false;
    },

    /**
     * Menghapus dompet secara langsung jika tidak memiliki transaksi,
     * atau menayangkan peringatan hapus jika dompet terkait dengan transaksi.
     */
    async deleteWalletFromDetail() {
      const txCount = this.getWalletTransactionCount(this.selectedWallet.id);

      if (txCount === 0) {
        await Alpine.store('account').deleteAccount(this.selectedWallet.id);
        this.openDetailModal = false;
        return;
      }

      this.openDeleteWarningModal = true;
    },

    /**
     * Melanjutkan dari peringatan ke modal konfirmasi ketik nama dompet.
     */
    proceedDeleteConfirmation() {
      this.openDeleteWarningModal = false;
      this.deleteConfirmName = '';
      this.openDeleteConfirmModal = true;

      this.$nextTick(() => {
        this.$refs.deleteConfirmInput?.focus();
      });
    },

    /**
     * Eksekusi penghapusan dompet setelah konfirmasi nama dompet cocok.
     */
    async confirmDeleteWallet() {
      if (this.deleteConfirmName.trim() !== this.selectedWallet.name) return;

      await Alpine.store('account').deleteAccount(this.selectedWallet.id);
      this.openDeleteConfirmModal = false;
      this.openDetailModal = false;
      this.deleteConfirmName = '';
    },

    /**
     * Mengonfirmasi koreksi saldo dompet dengan membuat transaksi penyesuaian otomatis.
     */
    async confirmCorrection() {
      const account = Alpine.store('account').accounts.find(
        (acc) => acc.id === this.formData.id
      );
      if (!account) return;

      await Alpine.store('account').updateAccount(this.formData.id, {
        name: this.formData.name.trim(),
        icon: this.formData.icon,
      });

      const currentBalance = this.getAccountRealBalance(this.formData.id);
      const diff = this.newCorrectionBalance - currentBalance;

      // Buat transaksi otomatis untuk penyesuaian selisih saldo
      if (diff !== 0) {
        await Alpine.store('transaction').addTransaction({
          account_id: this.formData.id,
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          description: 'Koreksi Saldo Otomatis',
        });
      }

      this.openCorrectionModal = false;
    },
  };
}
