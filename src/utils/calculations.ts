import type { WalletItem, TransactionItem } from './types';

// Hitung saldo real-time 1 dompet (Saldo Awal + Mutasi)
export const calculateSingleWalletBalance = (
  wallet: WalletItem,
  transactions: TransactionItem[]
): number => {
  if (!wallet || !wallet.id) return 0;
  const initial = Number(wallet.balance || 0);

  const mutation = transactions.reduce((acc, t) => {
    const amt = Number(t.amount || 0);

    // 1. Jika dompet ini adalah dompet utama/sumber
    if (t.wallet_id === wallet.id) {
      if (t.type === 'income') return acc + amt;
      if (t.type === 'expense' || t.type === 'transfer') return acc - amt;
    }

    // 2. Jika dompet ini adalah dompet penerima transfer
    if (t.type === 'transfer' && t.to_wallet_id === wallet.id) {
      return acc + amt;
    }

    return acc;
  }, 0);

  return initial + mutation;
};

// Hitung total saldo gabungan seluruh dompet
export const calculateTotalBalance = (
  wallets: WalletItem[],
  transactions: TransactionItem[]
): number => {
  return wallets.reduce(
    (acc, wallet) => acc + calculateSingleWalletBalance(wallet, transactions),
    0
  );
};
