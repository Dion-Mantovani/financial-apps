// src/services/analytics.service.ts
import * as analyticsQuery from '../query/analytics.query';
import type { AnalyticsResponse } from '../utils/types';

export async function getAnalyticsData(
  periodType: string = 'monthly',
  selectedDateStr: string = ''
): Promise<AnalyticsResponse> {
  const rawTransactions = await analyticsQuery.fetchTransactionsForAnalytics();

  const refDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();

  // Hitung rentang Tanggal berdasarkan periodType
  let startDate: Date;
  let endDate: Date;

  if (periodType === 'weekly') {
    // 7 Hari terakhir dari bulan/tanggal yang dipilih
    endDate = new Date(year, month + 1, 0);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);
  } else if (periodType === 'yearly') {
    // 1 Tahun penuh
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  } else {
    // Monthly (Default 1 Bulan penuh)
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59);
  }

  // ==========================================
  // 1. FILTER TRANSAKSI UTAMA SESUAI PERIODE
  // ==========================================
  const filteredTx = rawTransactions.filter((t) => {
    if (!t.transaction_date) return false;
    const d = new Date(t.transaction_date);

    if (periodType === 'yearly') {
      return d.getFullYear() === year;
    }

    // Mode 'weekly' dan 'monthly' sama-sama membaca transaksi bulan berjalan
    // agar data summary di bawah grafik tetap terhitung penuh
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // ==========================================
  // 2. KALKULASI SUMMARY MATRIKS FINANSIAL
  // ==========================================
  const totalIncome = filteredTx
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = filteredTx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netCashflow = totalIncome - totalExpense;
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const savingRate = totalIncome > 0 ? (netCashflow / totalIncome) * 100 : 0;

  // 3. Breakdown Top Kategori
  const categoryMap: Record<
    string,
    { name: string; icon: string; color: string; amount: number; count: number }
  > = {};

  filteredTx
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catId = t.category_id || 'unassigned';
      const catName = t.categories?.name || 'Lainnya';
      const catIcon = t.categories?.icon || 'tag';
      const catColor = t.categories?.color || '#2563eb'; // Fallback warna biru jika tidak ada di DB

      if (!categoryMap[catId]) {
        categoryMap[catId] = {
          name: catName,
          icon: catIcon,
          color: catColor,
          amount: 0,
          count: 0,
        };
      }
      categoryMap[catId].amount += Number(t.amount || 0);
      categoryMap[catId].count += 1;
    });

  const topCategories = Object.entries(categoryMap)
    .map(([id, item]) => ({
      id,
      name: item.name,
      icon: item.icon,
      color: item.color,
      amount: item.amount,
      count: item.count,
      percentage:
        totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Helper Hitung Minggu Kalender Asli (Presisi 0-4 untuk W1-W5)
  const getCalendarWeekIndex = (date: Date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    let dayOfWeek = firstDayOfMonth.getDay(); // 0 = Minggu, 1 = Senin, dst.
    if (dayOfWeek === 0) dayOfWeek = 7; // Samakan standar Senin = 1, Minggu = 7

    const dayOfMonth = date.getDate();
    const weekIndex = Math.floor((dayOfMonth + dayOfWeek - 2) / 7);
    return Math.min(4, Math.max(0, weekIndex)); // Pastikan return 0, 1, 2, 3, atau 4
  };

  // 4. Labels & Agregasi Chart Sesuai Periode
  let chartLabels: string[] = [];
  let incomeSeries: number[] = [];
  let expenseSeries: number[] = [];

  if (periodType === 'weekly') {
    chartLabels = ['W1', 'W2', 'W3', 'W4', 'W5'];
    incomeSeries = [0, 0, 0, 0, 0];
    expenseSeries = [0, 0, 0, 0, 0];

    // Ambil semua transaksi di bulan berjalan untuk dipetakan ke W1-W5
    const monthTx = rawTransactions.filter((t) => {
      if (!t.transaction_date) return false;
      const d = new Date(t.transaction_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    monthTx.forEach((t) => {
      const txDate = new Date(t.transaction_date);
      const weekIdx = getCalendarWeekIndex(txDate);
      const amt = Number(t.amount || 0);

      if (t.type === 'income') incomeSeries[weekIdx] += amt;
      if (t.type === 'expense') expenseSeries[weekIdx] += amt;
    });
  } else if (periodType === 'yearly') {
    // 4 Tahun terakhir
    const currentYear = year;
    chartLabels = [
      (currentYear - 3).toString(),
      (currentYear - 2).toString(),
      (currentYear - 1).toString(),
      currentYear.toString(),
    ];
    incomeSeries = [0, 0, 0, 0];
    expenseSeries = [0, 0, 0, 0];

    rawTransactions.forEach((t) => {
      if (!t.transaction_date) return;
      const txYear = new Date(t.transaction_date).getFullYear();
      const yearIdx = chartLabels.indexOf(txYear.toString());
      if (yearIdx !== -1) {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') incomeSeries[yearIdx] += amt;
        if (t.type === 'expense') expenseSeries[yearIdx] += amt;
      }
    });
  } else {
    // Monthly (6 Bulan Terakhir)
    const monthShortNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    chartLabels = [];
    incomeSeries = [0, 0, 0, 0, 0, 0];
    expenseSeries = [0, 0, 0, 0, 0, 0];

    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      chartLabels.push(monthShortNames[d.getMonth()]);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      monthKeys.push(`${yyyy}-${mm}`);
    }

    rawTransactions.forEach((t) => {
      if (!t.transaction_date) return;
      const txMonthKey = t.transaction_date.slice(0, 7);
      const idx = monthKeys.indexOf(txMonthKey);
      if (idx !== -1) {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') incomeSeries[idx] += amt;
        if (t.type === 'expense') expenseSeries[idx] += amt;
      }
    });
  }

  // ==========================================
  // HELPER & PALETTE KONTRAK WARNA KATEGORI
  // ==========================================
  const categoryColorMap: Record<string, string> = {
    'Makanan & Minuman': '#3b82f6', // Biru
    'Makan & Minum': '#3b82f6',
    Transportasi: '#f43f5e', // Merah
    Belanja: '#10b981', // Hijau / Emerald
    'Tagihan & Utilitas': '#f59e0b', // Amber / Orange
    Hiburan: '#8b5cf6', // Ungu
    Kesehatan: '#06b6d4', // Cyan
    Pendidikan: '#ec4899', // Pink
    Investasi: '#14b8a6', // Teal
    Lainnya: '#64748b', // Slate Grey
  };

  // Gunakan deklarasi 'function' biasa (auto-hoisted) atau letakkan di paling atas
  function getConsistentColor(name: string, fallbackColor?: string): string {
    if (
      fallbackColor &&
      fallbackColor !== '#2563eb' &&
      fallbackColor.startsWith('#')
    ) {
      return fallbackColor;
    }
    if (categoryColorMap[name]) return categoryColorMap[name];

    const palette = [
      '#3b82f6',
      '#f43f5e',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#06b6d4',
      '#ec4899',
      '#14b8a6',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  }

  // ==========================================
  // AGREGASI STACKED BAR (3 PERIODE TERAKHIR)
  // ==========================================
  let stackedLabels: string[] = [];
  let periodFilterFuncs: ((t: any) => boolean)[] = [];

  if (periodType === 'weekly') {
    stackedLabels = ['W1', 'W2', 'W3'];

    // Ambil 3 minggu aktif kalender
    periodFilterFuncs = [0, 1, 2].map((wIdx) => (t: any) => {
      const d = new Date(t.transaction_date);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        getCalendarWeekIndex(d) === wIdx
      );
    });
  } else if (periodType === 'yearly') {
    const y = year;
    stackedLabels = [(y - 2).toString(), (y - 1).toString(), y.toString()];
    periodFilterFuncs = [y - 2, y - 1, y].map((targetY) => (t: any) => {
      return new Date(t.transaction_date).getFullYear() === targetY;
    });
  } else {
    // Monthly (3 Bulan Terakhir)
    const monthShortNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    stackedLabels = [];
    const targetMonthKeys: string[] = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      stackedLabels.push(monthShortNames[d.getMonth()]);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      targetMonthKeys.push(`${yyyy}-${mm}`);
    }

    periodFilterFuncs = targetMonthKeys.map((key) => (t: any) => {
      return t.transaction_date && t.transaction_date.slice(0, 7) === key;
    });
  }

  // ==========================================
  // AGREGASI DONUT CHART (PER KATEGORI PENGELUARAN)
  // ==========================================
  // Pastikan mengambil transaksi pengeluaran dari periode terpilih
  const donutCategoryMap: Record<
    string,
    { name: string; color: string; amount: number }
  > = {};

  // Filter khusus transaksi pengeluaran di rentang aktif (rawTransactions / filteredTx)
  rawTransactions
    .filter((t) => {
      if (t.type !== 'expense' || !t.transaction_date) return false;
      const d = new Date(t.transaction_date);

      if (periodType === 'yearly') {
        return d.getFullYear() === year;
      }
      // Mode Monthly: Filter berdasarkan tahun dan bulan berjalan
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .forEach((t) => {
      const catName = t.categories?.name || 'Lainnya';
      const fixedColor = getConsistentColor(catName, t.categories?.color);

      if (!donutCategoryMap[catName]) {
        donutCategoryMap[catName] = {
          name: catName,
          color: fixedColor,
          amount: 0,
        };
      }
      donutCategoryMap[catName].amount += Number(t.amount || 0);
    });

  const donutCategories = Object.values(donutCategoryMap)
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount); // Urutkan dari pengeluaran terbesar

  // Map untuk memisahkan series per NAMA KATEGORI
  const categorySeriesMap: Record<
    string,
    { name: string; color: string; data: number[]; total: number }
  > = {};

  rawTransactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const catName = t.categories?.name || 'Lainnya';
      const fixedColor = getConsistentColor(catName, t.categories?.color);

      if (!categorySeriesMap[catName]) {
        categorySeriesMap[catName] = {
          name: catName,
          color: fixedColor,
          data: [0, 0, 0],
          total: 0,
        };
      }

      periodFilterFuncs.forEach((isMatch, idx) => {
        if (isMatch(t)) {
          const amt = Number(t.amount || 0);
          categorySeriesMap[catName].data[idx] += amt;
          categorySeriesMap[catName].total += amt;
        }
      });
    });

  // Urutkan series berdasarkan TOTAL PENGELUARAN TERBESAR
  const stackedSeries = Object.values(categorySeriesMap)
    .filter((item) => item.data.some((val) => val > 0))
    .sort((a, b) => a.total - b.total); // Urutan ascending agar saat di-stack ApexCharts, yang terbesar berada di posisi paling atas

  // 5. Matrix Metrics Calculation
  const daysInPeriod =
    periodType === 'weekly'
      ? 7
      : periodType === 'yearly'
        ? 365
        : new Date(year, month + 1, 0).getDate();
  const dailyBurnRate = Math.round(totalExpense / Math.max(1, daysInPeriod));
  const remainingCash = totalIncome - totalExpense;
  const dailySafeAllowance = Math.round(
    Math.max(0, remainingCash) / Math.max(1, daysInPeriod)
  );

  // Cari hari terboros & transaksi terbesar dari transaksi terfilter
  const sortedExpense = [...filteredTx]
    .filter((t) => t.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount));
  const maxTxAmount = sortedExpense[0] ? Number(sortedExpense[0].amount) : 0;
  const avgTxAmount =
    filteredTx.length > 0 ? Math.round(totalExpense / filteredTx.length) : 0;

  const topCatName = topCategories[0]?.name || 'Utama';
  const topCatPct = topCategories[0]?.percentage || 0;

  // const netCashflow = totalIncome - totalExpense;
  // // Micro Info: Rasio Beban Kas (Berapa % pemasukan yang habis buat pengeluaran)
  // const expenseRatio =
  //   totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

  // 1. Hitung Rentang Tanggal Periode Sebelumnya (Previous Period)
  const prevStartDate = new Date(startDate);
  const prevEndDate = new Date(endDate);

  if (periodType === 'weekly') {
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    prevEndDate.setDate(prevEndDate.getDate() - 7);
  } else if (periodType === 'yearly') {
    prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
    prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
  } else {
    // Monthly
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    prevEndDate.setMonth(prevEndDate.getMonth() - 1);
  }

  // 2. Filter Transaksi Periode Sebelumnya
  const prevTx = rawTransactions.filter((t) => {
    if (!t.transaction_date) return false;
    const txDate = new Date(t.transaction_date);
    return txDate >= prevStartDate && txDate <= prevEndDate;
  });

  const prevIncome = prevTx
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const prevExpense = prevTx
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // 3. Hitung Persentase Perubahan (%)
  const incomeDiffPercentage =
    prevIncome > 0
      ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100)
      : null;

  const expenseDiffPercentage =
    prevExpense > 0
      ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100)
      : null;

  return {
    summary: {
      income: totalIncome,
      expense: totalExpense,
      netCashflow,
      expenseRatio,
      incomeDiffPercentage,
      expenseDiffPercentage,
      savingRate,
    },
    chartData: {
      labels: chartLabels,
      incomeData: incomeSeries,
      expenseData: expenseSeries,
    },
    stackedBarData: {
      labels: stackedLabels,
      series:
        stackedSeries.length > 0
          ? stackedSeries
          : [
              {
                name: 'Pengeluaran',
                color: '#f43f5e',
                data: [totalExpense, totalExpense, totalExpense],
              },
            ],
    },
    donutData: {
      labels: donutCategories.map((c) => c.name),
      series: donutCategories.map((c) => c.amount),
      colors: donutCategories.map((c) => c.color),
    },
    topCategories,
    aiInsight: `Pengeluaran kategori ${topCatName} menyerap ${topCatPct}% dari belanja periode ini. Mengontrol jajan di kategori ini bisa menghemat anggaranmu!`,
    recommendation: `Disarankan mengalokasikan Rp ${new Intl.NumberFormat('id-ID').format(Math.max(0, Math.round(remainingCash * 0.4)))} dari sisa kas ke instrumen Reksa Dana / Pasar Uang.`,
    matrixMetrics: {
      core: [
        {
          label: 'Burn Rate Harian',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(dailyBurnRate)} /hr`,
          status: dailyBurnRate > 200000 ? 'Tinggi' : 'Normal',
          color: dailyBurnRate > 200000 ? 'text-amber-600' : 'text-slate-800',
          icon: 'flame',
        },
        {
          label: 'Sisa Jatah Harian', // <-- Kata-katanya diperbarui biar dapet
          value: `Rp ${new Intl.NumberFormat('id-ID').format(dailySafeAllowance)} /hr`,
          status: dailySafeAllowance > 50000 ? 'Aman Banget' : 'Ketat',
          color:
            dailySafeAllowance > 50000 ? 'text-emerald-600' : 'text-rose-600',
          icon: 'wallet',
        },
        {
          label: 'Skor Kesehatan',
          value: savingRate >= 20 ? '85 / 100' : '65 / 100',
          status: savingRate >= 20 ? 'Sangat Sehat' : 'Perlu Perhatian',
          color: 'text-emerald-600',
          icon: 'activity',
        },
        {
          label: 'Kepatuhan Anggaran',
          value: savingRate >= 10 ? '92%' : '70%',
          status: 'Disiplin',
          color: 'text-blue-600',
          icon: 'shield-check',
        },
      ],
      behavior: [
        {
          label: 'Transaksi Tertinggi',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(maxTxAmount)}`,
          status: 'Puncak',
          color: 'text-rose-600',
          icon: 'arrow-up-right',
        },
        {
          label: 'Total Transaksi',
          value: `${filteredTx.length} Transaksi`,
          status: 'Frekuensi',
          color: 'text-emerald-600',
          icon: 'receipt',
        },
        {
          label: 'Kategori Teratas',
          value: topCatName,
          status: `${topCatPct}% Porsi`,
          color: 'text-slate-800',
          icon: 'tag',
        },
        {
          label: 'Rata-rata Transaksi',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(avgTxAmount)}`,
          status: 'Stabil',
          color: 'text-blue-600',
          icon: 'calculator',
        },
      ],
      projection: [
        {
          label: 'Proyeksi Akhir Periode',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(Math.max(0, remainingCash))}`,
          status: remainingCash >= 0 ? 'Surplus' : 'Defisit',
          color: 'text-blue-600',
          icon: 'trending-up',
        },
        {
          label: 'Daya Tahan Saldo',
          value: `${Math.round(Math.max(0, remainingCash) / Math.max(1, dailyBurnRate))} Hari`,
          status: 'Safe',
          color: 'text-emerald-600',
          icon: 'clock',
        },
        {
          label: 'Potensi Hemat AI',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(totalExpense * 0.1))}`,
          status: 'Rekomendasi',
          color: 'text-amber-600',
          icon: 'sparkles',
        },
        {
          label: 'Target Investasi',
          value: `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(totalIncome * 0.2))}`,
          status: 'On Track',
          color: 'text-emerald-600',
          icon: 'piggy-bank',
        },
      ],
    },
  };
}
