import {
  getAllAccountsLocal,
  saveAccountLocal,
  deleteAccountLocal,
} from '../db/accounts.db.js';
import {
  createAccountRemote,
  updateAccountRemote,
  deleteAccountRemote,
} from '../services/account.service.js';
import { createTransactionRemote } from '../services/transaction.service.js';
import { saveTransactionLocal } from '../db/transactions.db.js';
import {
  calculateAccountBalance,
  calculateTotalAssets,
} from '../lib/calculations.js';

export default () => ({
  accounts: [],
  isLoading: false,

  async init() {
    this.isLoading = true;
    this.accounts = await getAllAccountsLocal();
    this.isLoading = false;
  },

  get activeAccounts() {
    return this.accounts.filter((acc) => acc.status === 'active');
  },

  // Mendapatkan Current Balance 1 account (membutuhkan list transaksi)
  getBalance(account, transactions = []) {
    return calculateAccountBalance(account, transactions);
  },

  // Mendapatkan Total Assets seluruh account (membutuhkan list transaksi)
  getTotalAssets(transactions = []) {
    return calculateTotalAssets(this.accounts, transactions);
  },

  async addAccount(accountData) {
    const newAccount = {
      id: crypto.randomUUID(),
      name: accountData.name,
      initial_balance: Number(accountData.initial_balance || 0),
      icon: accountData.icon || 'wallet',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic Update
    this.accounts.unshift(newAccount);
    await saveAccountLocal(newAccount);

    // 2. Update saved wallet order + UI order
    const savedOrder = JSON.parse(localStorage.getItem('wallet_order') || '[]');

    const newOrder = [
      newAccount.id,
      ...savedOrder.filter((id) => id !== newAccount.id),
    ];

    localStorage.setItem('wallet_order', JSON.stringify(newOrder));

    // Pastikan UI langsung mengikuti order baru
    const accountMap = new Map(
      this.accounts.map((account) => [account.id, account])
    );

    this.accounts = newOrder.map((id) => accountMap.get(id)).filter(Boolean);

    // 3. Sync Remote
    try {
      await createAccountRemote(newAccount);
    } catch (err) {
      console.warn(
        '⚠️ Sync Create Account gagal (tersimpan lokal):',
        err.message
      );
    }
  },

  async updateAccount(id, updatedFields) {
    const index = this.accounts.findIndex((acc) => acc.id === id);
    if (index === -1) return;

    const updatedAccount = {
      ...this.accounts[index],
      ...updatedFields,
      updated_at: new Date().toISOString(),
    };

    // 1. Optimistic Update
    this.accounts[index] = updatedAccount;
    await saveAccountLocal(updatedAccount);

    // 2. Sync Remote
    try {
      await updateAccountRemote(id, updatedAccount);
    } catch (err) {
      console.warn(
        '⚠️ Sync Update Account gagal (tersimpan lokal):',
        err.message
      );
    }
  },

  // Koreksi Saldo jika Account sudah memiliki transaksi
  async correctBalance(
    account,
    actualBalance,
    transactions = [],
    transactionStore
  ) {
    const currentBalance = this.getBalance(account, transactions);
    const diff = actualBalance - currentBalance;

    if (diff === 0) return; // Tidak ada perubahan saldo

    const type = diff > 0 ? 'income' : 'expense';
    const amount = Math.abs(diff);

    // Buat transaksi Correction Balance (category_id = NULL)
    const correctionTx = {
      id: crypto.randomUUID(),
      type: type,
      amount: amount,
      account_id: account.id,
      to_account_id: null,
      category_id: null,
      fee: null,
      transaction_date: new Date().toISOString().split('T')[0],
      description: 'Correction Balance',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Simpan transaksi koreksi via Transaction Store / Local DB
    if (transactionStore) {
      await transactionStore.addCorrectionTransaction(correctionTx);
    } else {
      await saveTransactionLocal(correctionTx);
      try {
        await createTransactionRemote(correctionTx);
      } catch (err) {
        console.warn('⚠️ Sync Correction Transaction gagal:', err.message);
      }
    }
  },

  async deleteAccount(id, transactionStore) {
    // 1. Optimistic Update (Hapus Account lokal)
    this.accounts = this.accounts.filter((acc) => acc.id !== id);
    await deleteAccountLocal(id);

    // 2. Hapus transaksi terkait jika ada (Cascade hard delete lokal)
    if (transactionStore) {
      await transactionStore.removeTransactionsByAccountId(id);
    }

    // 3. Sync Remote
    try {
      await deleteAccountRemote(id);
    } catch (err) {
      console.warn('⚠️ Sync Delete Account gagal:', err.message);
    }
  },
});
