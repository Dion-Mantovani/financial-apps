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

// Helper untuk simpan multiple categories sekaligus (saat initial sync)
export const bulkSaveCategoriesLocal = async (categories = []) => {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');
  await Promise.all(categories.map((cat) => tx.store.put(cat)));
  await tx.done;
};
