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

export interface BudgetItem {
  id?: string;
  user_id?: string;
  category_id: string;
  amount: number;
  period: string; // Format: 'YYYY-MM'
  created_at?: string;
  categories?: CategoryItem;
  [key: string]: any;
}

export interface ProcessedBudgetItem extends BudgetItem {
  spent: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
  barColor: string;
  badgeColor: string;
  iconColor: string;
}
