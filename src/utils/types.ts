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

export interface AnalyticsSummary {
  income: number;
  expense: number;
  netCashflow: number;
  expenseRatio: number;
  incomeDiffPercentage: number | null;
  expenseDiffPercentage: number | null;
  savingRate: number;
}

export interface AnalyticsCategorySpending {
  id: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface AnalyticsChartData {
  labels: string[];
  incomeData: number[];
  expenseData: number[];
}

export interface AnalyticsMatrixMetrics {
  core: MatrixMetricItem[];
  behavior: MatrixMetricItem[];
  projection: MatrixMetricItem[];
}

export interface MatrixMetricItem {
  label: string;
  value: string;
  status: string;
  color: string;
  icon: string;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  chartData: AnalyticsChartData;
  topCategories: AnalyticsCategorySpending[];
  aiInsight: string;
  recommendation: string;
  matrixMetrics: AnalyticsMatrixMetrics;
  stackedBarData?: {
    labels: string[]; // ['Jul', 'Agu', 'Sep'] atau ['W1', 'W2', 'W3'] atau ['2024', '2025', '2026']
    series: StackedBarSeries[];
  };
  donutData?: DonutChartData;
}

export interface StackedBarSeries {
  name: string; // Nama Kategori (misal: "Makan & Minum")
  color: string; // Warna Kategori
  data: number[]; // Nominal pengeluaran di 3 periode [P1, P2, P3]
}

export interface DonutChartData {
  labels: string[];
  series: number[];
  colors: string[];
}
