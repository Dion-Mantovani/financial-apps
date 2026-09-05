// src/utils/types.ts

export interface WalletItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
  icon: string;
  [key: string]: any;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: string;
  icon?: string;
  [key: string]: any;
}

export interface TransactionItem {
  id?: string;
  notes?: string;
  amount?: number | string;
  type?: 'income' | 'expense' | 'transfer' | string;
  wallet_id?: string;
  to_wallet_id?: string;
  category_id?: string;
  transaction_date?: string;
  created_at?: string;
  wallets?: WalletItem;
  to_wallets?: WalletItem;
  categories?: CategoryItem;
  [key: string]: any;
}

export interface FeatureItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface CustomQuickItem {
  title: string;
  amount: number;
  type: string;
  wallet_id: string;
  category_id?: string;
  isCustom?: boolean;
}
