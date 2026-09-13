import {
  getAllTransactionsLocal,
  saveTransactionLocal,
  deleteTransactionLocal,
} from '../db/transactions.db.js';
import {
  createTransactionRemote,
  updateTransactionRemote,
  deleteTransactionRemote,
} from '../services/transaction.service.js';

export default () => ({
  transactions: [],
  isLoading: false,

  async init() {
    this.isLoading = true;
    this.transactions = await getAllTransactionsLocal();
    // Urutkan transaksi dari yang terbaru berdasarkan transaction_date
    this.transactions.sort(
      (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)
    );
    this.isLoading = false;
  },

  // Smart Category Suggestion based on description history
  suggestCategory(descriptionText) {
    if (!descriptionText || descriptionText.trim() === '') return null;

    const query = descriptionText.trim().toLowerCase();

    // Cari transaksi sebelumnya yang memiliki deskripsi persis / serupa
    const matchedTx = this.transactions.find(
      (tx) =>
        tx.category_id &&
        tx.description &&
        tx.description.toLowerCase().includes(query)
    );

    return matchedTx ? matchedTx.category_id : null;
  },

  async addTransaction(txData, categories = []) {
    // Default description: jika kosong, gunakan nama category
    let finalDescription = txData.description
      ? txData.description.trim()
      : null;

    if (!finalDescription && txData.category_id) {
      const category = categories.find((cat) => cat.id === txData.category_id);
      if (category) finalDescription = category.name;
    }

    const newTx = {
      id: crypto.randomUUID(),
      type: txData.type, // expense / income / transfer
      amount: Number(txData.amount),
      account_id: txData.account_id,
      to_account_id: txData.type === 'transfer' ? txData.to_account_id : null,
      category_id: txData.type === 'transfer' ? null : txData.category_id,
      fee: txData.type === 'transfer' && txData.fee ? Number(txData.fee) : null,
      transaction_date: txData.transaction_date,
      description: finalDescription,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic Update (Urutkan kembali)
    this.transactions.unshift(newTx);
    await saveTransactionLocal(newTx);

    // 2. Sync Remote
    try {
      await createTransactionRemote(newTx);
    } catch (err) {
      console.warn('⚠️ Sync Create Transaction gagal:', err.message);
    }
  },

  async addCorrectionTransaction(correctionTx) {
    this.transactions.unshift(correctionTx);
    await saveTransactionLocal(correctionTx);
    try {
      await createTransactionRemote(correctionTx);
    } catch (err) {
      console.warn('⚠️ Sync Correction Transaction gagal:', err.message);
    }
  },

  async updateTransaction(id, updatedFields, categories = []) {
    const index = this.transactions.findIndex((tx) => tx.id === id);
    if (index === -1) return;

    let finalDescription = updatedFields.description
      ? updatedFields.description.trim()
      : null;
    if (!finalDescription && updatedFields.category_id) {
      const category = categories.find(
        (cat) => cat.id === updatedFields.category_id
      );
      if (category) finalDescription = category.name;
    }

    const updatedTx = {
      ...this.transactions[index],
      ...updatedFields,
      description: finalDescription,
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic Update
    this.transactions[index] = updatedTx;
    await saveTransactionLocal(updatedTx);

    // 2. Sync Remote
    try {
      await updateTransactionRemote(id, updatedTx);
    } catch (err) {
      console.warn('⚠️ Sync Update Transaction gagal:', err.message);
    }
  },

  async deleteTransaction(id) {
    // 1. Optimistic Update
    this.transactions = this.transactions.filter((tx) => tx.id !== id);
    await deleteTransactionLocal(id);

    // 2. Sync Remote
    try {
      await deleteTransactionRemote(id);
    } catch (err) {
      console.warn('⚠️ Sync Delete Transaction gagal:', err.message);
    }
  },

  // Helper saat Kategori dihapus (Reassign ke Kategori lain)
  async reassignCategory(oldCategoryId, newCategoryId) {
    const affectedTxs = this.transactions.filter(
      (tx) => tx.category_id === oldCategoryId
    );

    for (const tx of affectedTxs) {
      tx.category_id = newCategoryId;
      tx.updated_at = new Date().toISOString();
      await saveTransactionLocal(tx);
      try {
        await updateTransactionRemote(tx.id, { category_id: newCategoryId });
      } catch (err) {
        console.warn('⚠️ Sync Reassign Category gagal:', err.message);
      }
    }
  },

  // Helper saat Account dihapus (Hard delete transaksi terkait)
  async removeTransactionsByAccountId(accountId) {
    const toDelete = this.transactions.filter(
      (tx) => tx.account_id === accountId || tx.to_account_id === accountId
    );

    for (const tx of toDelete) {
      await this.deleteTransaction(tx.id);
    }
  },
});
