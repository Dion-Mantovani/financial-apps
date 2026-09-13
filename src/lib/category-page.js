export const categoryIcons = [
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

  // --- NEUTRAL ---
  { id: 'circle-ellipsis', name: 'Lainnya', type: 'both' },
];

export const categoryPageData = () => ({
  catStore: categoryStore(),
  txStore: transactionStore(),
  activeTab: 'expense',
  openFormModal: false,
  openDetailModal: false,
  openReassignModal: false,
  openIconPicker: false,
  isEdit: false,
  selectedCategory: { id: '', name: '', type: 'expense', icon: 'utensils' },
  formData: {
    id: null,
    name: '',
    type: 'expense',
    icon: 'utensils',
  },
  targetCategoryId: '',
  availableIcons: categoryIcons,

  async init() {
    if (!this.catStore.categories.length) {
      await this.catStore.init();
    }
    if (!this.txStore.transactions.length) {
      await this.txStore.init();
    }
  },

  get filteredCategories() {
    return this.catStore.categories.filter((c) => c.type === this.activeTab);
  },

  get filteredAvailableIcons() {
    return this.availableIcons.filter(
      (icon) => icon.type === this.formData.type || icon.type === 'both'
    );
  },

  get availableReassignCategories() {
    return this.catStore.categories.filter(
      (c) =>
        c.type === this.selectedCategory.type &&
        c.id !== this.selectedCategory.id
    );
  },

  get usedTransactionCount() {
    if (!this.selectedCategory.id) return 0;
    return this.txStore.transactions.filter(
      (tx) => tx.category_id === this.selectedCategory.id
    ).length;
  },

  setFormType(type) {
    this.formData.type = type;
    if (!this.filteredAvailableIcons.some((i) => i.id === this.formData.icon)) {
      this.formData.icon = type === 'expense' ? 'utensils' : 'wallet';
    }
  },

  showDetail(cat) {
    this.selectedCategory = { ...cat };
    this.openDetailModal = true;
  },

  openAddModal() {
    this.isEdit = false;
    this.formData = {
      id: null,
      name: '',
      type: this.activeTab,
      icon: this.activeTab === 'expense' ? 'utensils' : 'wallet',
    };
    this.openIconPicker = false;
    this.openFormModal = true;
  },

  openEditFromDetail() {
    this.isEdit = true;
    this.formData = { ...this.selectedCategory };
    this.openDetailModal = false;
    this.openIconPicker = false;
    this.openFormModal = true;
  },

  async attemptDeleteCategory() {
    if (this.usedTransactionCount > 0) {
      const available = this.availableReassignCategories;
      this.targetCategoryId = available.length > 0 ? available[0].id : '';
      this.openDetailModal = false;
      this.openReassignModal = true;
    } else {
      await this.catStore.deleteCategory(this.selectedCategory.id);
      this.openDetailModal = false;
    }
  },

  async confirmReassignAndDelete() {
    if (!this.targetCategoryId) return;
    await this.catStore.deleteCategory(
      this.selectedCategory.id,
      this.targetCategoryId,
      this.txStore
    );
    this.openReassignModal = false;
  },

  async saveCategory() {
    if (!this.formData.name.trim()) return;

    if (this.isEdit) {
      await this.catStore.updateCategory(this.formData.id, {
        name: this.formData.name.trim(),
        type: this.formData.type,
        icon: this.formData.icon,
      });
    } else {
      await this.catStore.addCategory({
        name: this.formData.name.trim(),
        type: this.formData.type,
        icon: this.formData.icon,
      });
    }
    this.openFormModal = false;
  },
});

// Pendaftaran otomatis ke Alpine (Bebas error TS di file .astro)
const registerData = () => {
  if (window.Alpine) {
    window.Alpine.data('categoryPageData', categoryPageData);
  } else {
    document.addEventListener('alpine:init', () => {
      window.Alpine.data('categoryPageData', categoryPageData);
    });
  }
};

registerData();
