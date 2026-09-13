/**
 * Memeriksa apakah transaksi sudah berlaku (bukan upcoming).
 * Transaction date dikelompokkan berdasarkan tanggal (YYYY-MM-DD).
 */
export const isTransactionActive = (transactionDateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const txDate = new Date(transactionDateStr);
  txDate.setHours(0, 0, 0, 0);

  return txDate <= today;
};

/**
 * Menghitung Current Balance untuk 1 Account tertentu.
 *
 * @param {Object} account - Object account
 * @param {Array} transactions - Array seluruh transaksi dari IndexedDB
 * @returns {number} Current balance
 */
export const calculateAccountBalance = (account, transactions = []) => {
  let balance = Number(account.initial_balance || 0);

  transactions.forEach((tx) => {
    // Abaikan jika transaksi belum berlaku (Upcoming)
    if (!isTransactionActive(tx.transaction_date)) return;

    const amount = Number(tx.amount || 0);
    const fee = Number(tx.fee || 0);

    // 1. Transaksi di mana Account ini sebagai Sumber (account_id)
    if (tx.account_id === account.id) {
      if (tx.type === 'expense') {
        balance -= amount;
      } else if (tx.type === 'income') {
        balance += amount;
      } else if (tx.type === 'transfer') {
        balance -= amount; // Potong nominal transfer keluar
        balance -= fee; // Potong admin fee jika ada
      }
    }

    // 2. Transaksi di mana Account ini sebagai Penerima (to_account_id)
    if (tx.to_account_id === account.id && tx.type === 'transfer') {
      balance += amount; // Tambah nominal transfer masuk
    }
  });

  return balance;
};

/**
 * Menghitung Total Assets dari seluruh akun (Active & Inactive).
 *
 * @param {Array} accounts - Seluruh akun
 * @param {Array} transactions - Seluruh transaksi
 * @returns {number} Total aset
 */
export const calculateTotalAssets = (accounts = [], transactions = []) => {
  return accounts.reduce((total, account) => {
    return total + calculateAccountBalance(account, transactions);
  }, 0);
};
