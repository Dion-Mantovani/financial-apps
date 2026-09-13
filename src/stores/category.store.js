import {
  getAllCategoriesLocal,
  saveCategoryLocal,
  deleteCategoryLocal,
} from '../db/categories.db.js';
import {
  createCategoryRemote,
  updateCategoryRemote,
  deleteCategoryRemote,
} from '../services/category.service.js';

export default () => ({
  categories: [],
  isLoading: false,

  async init() {
    this.isLoading = true;
    this.categories = await getAllCategoriesLocal();
    this.isLoading = false;
  },

  get expenseCategories() {
    return this.categories.filter((cat) => cat.type === 'expense');
  },

  get incomeCategories() {
    return this.categories.filter((cat) => cat.type === 'income');
  },

  async addCategory(categoryData) {
    const newCategory = {
      id: crypto.randomUUID(),
      name: categoryData.name,
      type: categoryData.type,
      icon: categoryData.icon || 'tag',
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic Update
    this.categories.push(newCategory);
    await saveCategoryLocal(newCategory);

    // 2. Sync Remote
    try {
      await createCategoryRemote(newCategory);
    } catch (err) {
      console.warn('⚠️ Sync Create Category gagal:', err.message);
    }
  },

  async updateCategory(id, updatedFields) {
    const index = this.categories.findIndex((cat) => cat.id === id);
    if (index === -1) return;

    const updatedCategory = {
      ...this.categories[index],
      ...updatedFields,
      updated_at: new Date().toISOString(),
    };

    this.categories[index] = updatedCategory;
    await saveCategoryLocal(updatedCategory);

    try {
      await updateCategoryRemote(id, updatedCategory);
    } catch (err) {
      console.warn('⚠️ Sync Update Category gagal:', err.message);
    }
  },

  // Menghapus kategori & me-reassign transaksi terkait ke kategori baru
  async deleteCategory(id, targetCategoryId = null, transactionStore = null) {
    // 1. Reassign transaksi jika kategori digunakan
    if (targetCategoryId && transactionStore) {
      await transactionStore.reassignCategory(id, targetCategoryId);
    }

    // 2. Optimistic Update (Hapus Kategori)
    this.categories = this.categories.filter((cat) => cat.id !== id);
    await deleteCategoryLocal(id);

    // 3. Sync Remote
    try {
      await deleteCategoryRemote(id);
    } catch (err) {
      console.warn('⚠️ Sync Delete Category gagal:', err.message);
    }
  },
});
