// src/features/category.ui.js

/**
 * Controller UI untuk Manajemen Kategori Transaksi (Alpine.js Component)
 * Menangani tab kategori, modal form, modal detail, reassign kategori, dan pilihan ikon.
 *
 * @returns {Object} Alpine Component Object
 */
export function categoryUI() {
  return {
    // ==========================================
    // 1. STATE & MODAL CONTROLLERS
    // ==========================================
    activeTab: 'expense', // 'expense' | 'income'

    // Modal Visibility States
    openFormModal: false,
    openDetailModal: false,
    openReassignModal: false,
    openDeleteConfirmModal: false,
    openIconPicker: false,

    // Form & Selection States
    isEdit: false,
    selectedCategory: {
      id: '',
      name: '',
      type: 'expense',
      icon: 'utensils',
    },
    formData: {
      id: null,
      name: '',
      type: 'expense',
      icon: 'utensils',
    },

    // State Reassign Kategori saat Hapus
    targetCategoryId: '',

    // Master List Ikon beserta Pemetaan Tipe
    availableIcons: [
      // --- EXPENSE ICONS ---
      { id: 'utensils', name: 'Makanan', type: 'expense' },
      { id: 'car', name: 'Transport', type: 'expense' },
      { id: 'shopping-bag', name: 'Belanja', type: 'expense' },
      { id: 'gamepad-2', name: 'Hiburan', type: 'expense' },
      { id: 'heart-pulse', name: 'Kesehatan', type: 'expense' },
      { id: 'receipt', name: 'Tagihan', type: 'expense' },
      { id: 'zap', name: 'Listrik', type: 'expense' },
      { id: 'droplets', name: 'Air', type: 'expense' },
      { id: 'wifi', name: 'Internet', type: 'expense' },
      { id: 'home', name: 'Rumah', type: 'expense' },
      { id: 'coffee', name: 'Kopi', type: 'expense' },
      { id: 'shirt', name: 'Fashion', type: 'expense' },
      { id: 'film', name: 'Streaming', type: 'expense' },
      { id: 'dumbbell', name: 'Olahraga', type: 'expense' },
      { id: 'scissors', name: 'Perawatan', type: 'expense' },
      { id: 'graduation-cap', name: 'Pendidikan', type: 'expense' },
      { id: 'baby', name: 'Anak', type: 'expense' },
      { id: 'paw-print', name: 'Peliharaan', type: 'expense' },
      { id: 'plane', name: 'Travel', type: 'expense' },
      { id: 'fuel', name: 'Bensin', type: 'expense' },
      { id: 'wrench', name: 'Servis', type: 'expense' },
      { id: 'credit-card', name: 'Cicilan', type: 'expense' },

      // --- INCOME ICONS ---
      { id: 'briefcase', name: 'Pekerjaan', type: 'income' },
      { id: 'gift', name: 'Hadiah', type: 'income' },
      { id: 'trending-up', name: 'Investasi', type: 'income' },
      { id: 'wallet', name: 'Gaji', type: 'income' },
      { id: 'piggy-bank', name: 'Tabungan', type: 'income' },
      { id: 'coins', name: 'Passive', type: 'income' },
      { id: 'building', name: 'Sewa', type: 'income' },

      // --- KEDUA TIPE ---
      { id: 'circle-ellipsis', name: 'Lainnya', type: 'both' },
    ],

    // ==========================================
    // 2. LIFECYCLE HOOKS
    // ==========================================
    /**
     * Memuat data kategori dan transaksi dari Alpine Stores saat komponen diinisialisasi.
     */
    async init() {
      await Promise.all([
        Alpine.store('category').loadCategories(),
        Alpine.store('transaction').loadTransactions(),
      ]);
    },

    // ==========================================
    // 3. GETTERS (COMPUTED PROPERTIES)
    // ==========================================
    /**
     * Filter kategori berdasarkan tab aktif (expense/income) dan urutkan dari yang terbaru.
     */
    get filteredCategories() {
      const categories = Alpine.store('category').categories || [];
      return [...categories]
        .filter((c) => c.type === this.activeTab)
        .sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
    },

    /**
     * Opsi kategori alternatif untuk pemindahan transaksi (reassign) saat kategori dihapus.
     */
    get availableReassignCategories() {
      const categories = Alpine.store('category').categories || [];
      return categories.filter(
        (c) =>
          c.type === this.selectedCategory.type &&
          c.id !== this.selectedCategory.id
      );
    },

    /**
     * Menghitung berapa kali kategori yang dipilih digunakan dalam transaksi.
     */
    get usedTransactionCount() {
      if (!this.selectedCategory.id) return 0;
      const transactions = Alpine.store('transaction').transactions || [];
      return transactions.filter(
        (tx) => tx.category_id === this.selectedCategory.id
      ).length;
    },

    /**
     * Filter ikon yang sesuai dengan tipe tipe form yang dipilih ('expense'/'income' atau 'both').
     */
    get filteredAvailableIcons() {
      return this.availableIcons.filter(
        (icon) => icon.type === this.formData.type || icon.type === 'both'
      );
    },

    // ==========================================
    // 4. HELPER & BUSINESS LOGIC
    // ==========================================
    /**
     * Mengubah tipe kategori pada form dan menyesuaikan ikon default jika tidak cocok.
     *
     * @param {'expense'|'income'} type Tipe kategori baru
     */
    setFormType(type) {
      this.formData.type = type;
      if (
        !this.filteredAvailableIcons.some((i) => i.id === this.formData.icon)
      ) {
        this.formData.icon = type === 'expense' ? 'utensils' : 'wallet';
      }
    },

    // ==========================================
    // 5. MODAL & FORM CONTROLLERS
    // ==========================================
    /**
     * Membuka modal detail kategori.
     *
     * @param {Object} cat - Object data kategori
     */
    showDetail(cat) {
      this.selectedCategory = { ...cat };
      this.openDetailModal = true;
    },

    /**
     * Membuka modal form tambah kategori baru.
     */
    openAddModal() {
      this.isEdit = false;
      this.formData = {
        id: null,
        name: '',
        type: this.activeTab,
        icon: this.activeTab === 'expense' ? 'utensils' : 'wallet',
      };
      this.openIconPicker = true;
      this.openFormModal = true;

      this.$nextTick(() => {
        this.$refs.categoryNameInput?.focus();
      });
    },

    /**
     * Membuka modal form edit kategori dari modal detail.
     */
    openEditFromDetail() {
      this.isEdit = true;
      this.formData = { ...this.selectedCategory };
      this.openDetailModal = false;
      this.openIconPicker = true;
      this.openFormModal = true;
    },

    // ==========================================
    // 6. CRUD ACTIONS & HANDLERS
    // ==========================================
    /**
     * Menyimpan kategori baru atau memperbarui kategori yang ada.
     */
    async saveCategory() {
      if (!this.formData.name.trim()) return;

      const catStore = Alpine.store('category');
      if (this.isEdit) {
        await catStore.updateCategory(this.formData.id, {
          name: this.formData.name.trim(),
          type: this.formData.type,
          icon: this.formData.icon,
        });
      } else {
        await catStore.addCategory({
          name: this.formData.name.trim(),
          type: this.formData.type,
          icon: this.formData.icon,
        });
      }
      this.openFormModal = false;
    },

    /**
     * Percobaan menghapus kategori. Jika terikat dengan transaksi, alihkan ke modal reassign.
     */
    async attemptDeleteCategory() {
      if (this.usedTransactionCount > 0) {
        this.openDetailModal = false;
        this.openReassignModal = true;
        return;
      }

      await Alpine.store('category').deleteCategory(this.selectedCategory.id);
      this.openDetailModal = false;
    },
  };
}
