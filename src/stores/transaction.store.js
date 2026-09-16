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
  suggestCategory(descriptionText, type = null) {
    if (!descriptionText || descriptionText.trim() === '') return null;

    const query = descriptionText.trim().toLowerCase();

    const candidates = this.transactions
      .filter((tx) => {
        if (!tx.category_id || !tx.description) return false;
        if (tx.type === 'transfer') return false;

        // Kalau type dikirim, hanya cari dari type yang sama
        if (type && tx.type !== type) return false;

        return true;
      })
      .map((tx) => {
        const description = tx.description.trim().toLowerCase();

        let score = 0;

        // Prioritas kecocokan
        if (description === query) {
          score = 3;
        } else if (description.startsWith(query)) {
          score = 2;
        } else if (description.includes(query)) {
          score = 1;
        }

        return {
          tx,
          score,
          date: new Date(tx.transaction_date || tx.created_at || 0),
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        // Match lebih kuat dulu
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        // Kalau sama kuat, transaksi terbaru
        return b.date - a.date;
      });

    return candidates[0]?.tx.category_id || null;
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

      return {
        success: true,
        transaction: newTx,
      };
    } catch (err) {
      console.warn('⚠️ Sync Create Transaction gagal:', err.message);

      return {
        success: false,
        transaction: newTx,
        error: err,
      };
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
      const updatedTx = {
        ...tx,
        category_id: newCategoryId,
        updated_at: new Date().toISOString(),
      };

      // Update state Alpine
      const index = this.transactions.findIndex((item) => item.id === tx.id);

      if (index !== -1) {
        this.transactions[index] = updatedTx;
      }

      // Simpan plain object ke IndexedDB
      await saveTransactionLocal(updatedTx);

      // Sync ke Supabase
      try {
        await updateTransactionRemote(tx.id, {
          category_id: newCategoryId,
          updated_at: updatedTx.updated_at,
        });
      } catch (err) {
        console.warn('⚠️ Sync Reassign Category gagal:', err.message);
      }
    }
  },
  async reassignCategory(oldCategoryId, newCategoryId) {
    const affectedTxs = this.transactions.filter(
      (tx) => tx.category_id === oldCategoryId
    );

    for (const tx of affectedTxs) {
      const updatedTx = {
        ...tx,
        category_id: newCategoryId,
        updated_at: new Date().toISOString(),
      };

      // Update state Alpine
      const index = this.transactions.findIndex((item) => item.id === tx.id);

      if (index !== -1) {
        this.transactions[index] = updatedTx;
      }

      // Simpan plain object ke IndexedDB
      await saveTransactionLocal(updatedTx);

      // Sync ke Supabase
      try {
        await updateTransactionRemote(tx.id, {
          category_id: newCategoryId,
          updated_at: updatedTx.updated_at,
        });
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
