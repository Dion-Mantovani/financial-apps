// Format Angka ke IDR (Rupiah)
export const formatCurrency = (
  amount: number | string,
  type?: string
): string => {
  const val = Number(amount || 0);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);

  if (type === 'income') return `+ ${formatted}`;
  if (type === 'expense') return `- ${formatted}`;
  return formatted;
};

// Format Pengelompokan Tanggal Riwayat (Hari Ini, Kemarin, Tgl Bulanan)
export const formatDateGroup = (dateStr?: string): string => {
  if (!dateStr) return 'Lainnya';
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hari Ini';
  if (date.toDateString() === yesterday.toDateString()) return 'Kemarin';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

// Format untuk default nilai Input Date (YYYY-MM-DD)
export const getTodayInputDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export function formatUltraCompact(value: number): string {
  if (!value || value === 0) return '0';
  const absValue = Math.abs(value);
  const prefix = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${prefix}${(absValue / 1_000_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000_000) {
    return `${prefix}${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${prefix}${Math.round(absValue / 1_000)}rb`;
  }
  return `${prefix}${absValue}`;
}
