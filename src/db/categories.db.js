import { initDB } from './indexeddb';

export const getAllCategoriesLocal = async () => {
  const db = await initDB();
  return db.getAll('categories');
};

export const saveCategoryLocal = async (category) => {
  const db = await initDB();
  return db.put('categories', category);
};

export const deleteCategoryLocal = async (id) => {
  const db = await initDB();
  return db.delete('categories', id);
};

// Helper untuk simpan multiple categories sekaligus
export const bulkSaveCategoriesLocal = async (categories = []) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');

  await Promise.all(categories.map((cat) => tx.store.put(cat)));

  await tx.done;
};

// Replace seluruh kategori lokal agar sama dengan data dari Supabase
export const replaceAllCategoriesLocal = async (categories = []) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');

  await tx.store.clear();

  for (const category of categories) {
    await tx.store.put(category);
  }

  await tx.done;
};
