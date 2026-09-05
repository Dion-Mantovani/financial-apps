import ApexCharts from 'apexcharts';
import { apiClient } from '../services/apiClient';
import { formatCurrency } from '../utils/formatters';
import { calculateTotalBalance } from '../utils/calculations';
import { getCache, setCache } from '../utils/cache';
import type {
  WalletItem,
  CategoryItem,
  TransactionItem,
  FeatureItem,
  CustomQuickItem,
} from '../utils/types';

export function dashboardController() {
  return {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    chartInstance: null as ApexCharts | null,

    showDetails: false,
    openModal: false,
    hideBalance: localStorage.getItem('studion_hide_balance') === 'true',
    loading: true,

    isReorderingFeatures: false,
    initialFeaturesJson: '',
    featuresList: [] as FeatureItem[],

    wallets: [] as WalletItem[],
    transactions: [] as TransactionItem[],
    categories: [] as CategoryItem[],
    customQuicks: [] as CustomQuickItem[],

    isSubmittingQuick: false,
    showToast: false,
    toastMessage: '',

    openCustomQuickModal: false,
    customQuickForm: {
      notes: '',
      amount: '',
      wallet_id: '',
      category_id: '',
      type: 'expense',
    },

    // ==========================================
    // 2. LIFECYCLE & SWR DATA FETCHING
    // ==========================================
    async init() {
      // Step 1: Load instan dari Cache (0 ms delay)
      this.fetchDataFromCache();

      if (this.transactions.length > 0) {
        (this as any).$nextTick(() => {
          this.renderWeeklyChart();
        });
      }

      this.loadFeaturesOrder();
      this.loadCustomQuicks();

      (this as any).$watch('hideBalance', (val: boolean) => {
        localStorage.setItem('studion_hide_balance', String(val));
      });

      (this as any).$watch('customQuickForm.type', () => {
        const available = this.filteredCustomCategories;
        if (available.length > 0) {
          this.customQuickForm.category_id = available[0].id;
        } else {
          this.customQuickForm.category_id = '';
        }
      });

      // Step 2: Revalidate data dari Server di background
      await this.fetchData();
    },

    fetchDataFromCache() {
      const cachedWallets = getCache<WalletItem[]>('studion_cache_wallets');
      const cachedTransactions = getCache<TransactionItem[]>(
        'studion_cache_transactions'
      );
      const cachedCategories = getCache<CategoryItem[]>(
        'studion_cache_categories'
      );

      if (cachedWallets) this.wallets = cachedWallets;
      if (cachedTransactions) this.transactions = cachedTransactions;
      if (cachedCategories) this.categories = cachedCategories;

      if (cachedWallets || cachedTransactions || cachedCategories) {
        this.loading = false;
      }
    },

    async fetchData() {
      if (this.transactions.length === 0) {
        this.loading = true;
      }

      try {
        const [rawWallets, rawTransactions, rawCategories] = await Promise.all([
          apiClient.getWallets<WalletItem[]>(),
          apiClient.getTransactions<TransactionItem[]>(),
          apiClient.getCategories<CategoryItem[]>(),
        ]);

        this.wallets = rawWallets;
        this.transactions = rawTransactions;
        this.categories = rawCategories;

        setCache('studion_cache_wallets', rawWallets);
        setCache('studion_cache_transactions', rawTransactions);
        setCache('studion_cache_categories', rawCategories);

        (this as any).$nextTick(() => {
          this.renderWeeklyChart();
        });
      } catch (e) {
        console.error('SWR Revalidate Dashboard Failed:', e);
      } finally {
        this.loading = false;
      }
    },

    loadCustomQuicks() {
      const saved = localStorage.getItem('studion_custom_quicks');
      if (saved) {
        try {
          this.customQuicks = JSON.parse(saved);
        } catch (e) {
          console.error(e);
          this.customQuicks = [];
        }
      } else {
        this.customQuicks = [];
      }
    },

    loadFeaturesOrder() {
      const defaults: FeatureItem[] = [
        { id: 'wallet', label: 'Dompet', icon: 'wallet', href: '/wallet' },
        {
          id: 'budget',
          label: 'Anggaran',
          icon: 'piggy-bank',
          href: '/budget',
        },
        {
          id: 'categories',
          label: 'Kategori',
          icon: 'grid',
          href: '/categories',
        },
        { id: 'goals', label: 'Impian', icon: 'target', href: '/goals' },
        { id: 'debts', label: 'Utang', icon: 'receipt', href: '/debts' },
        {
          id: 'subscriptions',
          label: 'Langganan',
          icon: 'repeat',
          href: '/subscriptions',
        },
        {
          id: 'reports',
          label: 'Laporan',
          icon: 'bar-chart-2',
          href: '/reports',
        },
      ];

      const savedOrderJson = localStorage.getItem('studion_features_order');
      if (savedOrderJson) {
        try {
          const savedIds: string[] = JSON.parse(savedOrderJson);
          const ordered = [...defaults].sort((a, b) => {
            const idxA = savedIds.indexOf(a.id);
            const idxB = savedIds.indexOf(b.id);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
          this.featuresList = ordered;
          return;
        } catch (e) {
          console.error(e);
        }
      }
      this.featuresList = defaults;
    },

    // ==========================================
    // 3. COMPUTED & GETTERS
    // ==========================================
    get formattedTotalBalance() {
      const total = calculateTotalBalance(this.wallets, this.transactions);
      return formatCurrency(total);
    },

    get currentMonthName() {
      return new Date().toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    },

    get monthlyGrowth() {
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const hasPastMonthData = this.transactions.some((tx) => {
        const txDate = new Date(tx.transaction_date || tx.created_at || '');
        return txDate < firstDayThisMonth;
      });

      if (!hasPastMonthData) {
        return {
          isFirstMonth: true,
          label: 'Bulan Pertama',
          percentage: 0,
          isUp: true,
        };
      }

      const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let incomeThisMonth = 0;
      let expenseThisMonth = 0;

      this.transactions.forEach((tx) => {
        const txDateStr = tx.transaction_date
          ? tx.transaction_date.split('T')[0]
          : '';
        if (txDateStr.startsWith(currentMonthPrefix)) {
          if (tx.type === 'income') incomeThisMonth += Number(tx.amount || 0);
          if (tx.type === 'expense') expenseThisMonth += Number(tx.amount || 0);
        }
      });

      const totalBalanceNow = calculateTotalBalance(
        this.wallets,
        this.transactions
      );
      const startOfMonthBalance =
        totalBalanceNow - (incomeThisMonth - expenseThisMonth);

      if (startOfMonthBalance <= 0) {
        return {
          isFirstMonth: false,
          label: '+100%',
          percentage: 100,
          isUp: true,
        };
      }

      const diff = totalBalanceNow - startOfMonthBalance;
      const percent = Math.round((diff / startOfMonthBalance) * 100);

      return {
        isFirstMonth: false,
        label: `${percent >= 0 ? '+' : ''}${percent}%`,
        percentage: Math.abs(percent),
        isUp: percent >= 0,
      };
    },

    get formattedMonthlyIncome() {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const total = this.transactions
        .filter((t) => {
          const txDate = t.transaction_date
            ? t.transaction_date.split('T')[0]
            : '';
          return t.type === 'income' && txDate.startsWith(currentYearMonth);
        })
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      return formatCurrency(total);
    },

    get formattedMonthlyExpense() {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const total = this.transactions
        .filter((t) => {
          const txDate = t.transaction_date
            ? t.transaction_date.split('T')[0]
            : '';
          return t.type === 'expense' && txDate.startsWith(currentYearMonth);
        })
        .reduce((acc, t) => acc + Number(t.amount || 0), 0);

      return formatCurrency(total);
    },

    get recentTransactionsList() {
      return [...this.transactions].slice(0, 5);
    },

    get frequentTransactions() {
      const customs = this.customQuicks.map((item) => ({
        ...item,
        isCustom: true,
      }));
      if (customs.length >= 5) return customs.slice(0, 5);
      if (!this.transactions || this.transactions.length === 0) return customs;

      const counts: Record<
        string,
        {
          title: string;
          amount: number;
          type: string;
          wallet_id: string;
          category_id?: string;
          count: number;
        }
      > = {};

      this.transactions.forEach((tx) => {
        if (!tx.notes || tx.type === 'transfer') return;
        const key = `${tx.notes.trim().toLowerCase()}_${tx.amount}`;
        if (!counts[key]) {
          counts[key] = {
            title: tx.notes.trim(),
            amount: Number(tx.amount || 0),
            type: tx.type || 'expense',
            wallet_id: tx.wallet_id || '',
            category_id: tx.category_id,
            count: 1,
          };
        } else {
          counts[key].count += 1;
        }
      });

      const systemItems = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .filter(
          (sys) =>
            !customs.some(
              (c) =>
                c.title.toLowerCase() === sys.title.toLowerCase() &&
                Number(c.amount) === Number(sys.amount)
            )
        );

      const remainingSlots = 5 - customs.length;
      return [...customs, ...systemItems.slice(0, remainingSlots)];
    },

    get topQuickFeatures() {
      return this.featuresList.slice(0, 3);
    },

    get filteredCustomCategories() {
      return this.categories.filter(
        (c) => c.type === this.customQuickForm.type
      );
    },

    get formattedCustomAmount() {
      if (!this.customQuickForm.amount) return '';
      const num = parseInt(this.customQuickForm.amount, 10);
      if (isNaN(num)) return '';
      return new Intl.NumberFormat('id-ID').format(num);
    },

    get formattedWeeklyExpenseTotal() {
      const total = this.weeklyExpensesData.reduce(
        (acc, curr) => acc + curr.amount,
        0
      );
      return formatCurrency(total);
    },

    get weeklyExpensesData() {
      const daysName = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Ming'];
      const now = new Date();

      const currentDayOfWeek = now.getDay();
      const distanceToMonday =
        currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

      const monday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - distanceToMonday
      );

      const formatLocalYYYYMMDD = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
      };

      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate() + i
        );
        return {
          labelArray: [daysName[i], String(d.getDate())],
          fullDate: formatLocalYYYYMMDD(d),
          amount: 0,
        };
      });

      if (this.transactions && this.transactions.length > 0) {
        this.transactions.forEach((tx) => {
          if (tx.type !== 'expense') return;
          const txDateStr = tx.transaction_date
            ? tx.transaction_date.split('T')[0]
            : '';
          const matched = weekDays.find((w) => w.fullDate === txDateStr);
          if (matched) {
            matched.amount += Number(tx.amount || 0);
          }
        });
      }

      return weekDays;
    },

    // ==========================================
    // 4. CHART LOGIC
    // ==========================================
    renderWeeklyChart() {
      const chartEl = (this as any).$refs.weeklyChart;
      if (!chartEl) return;

      const categories = this.weeklyExpensesData.map((w) => w.labelArray);
      const seriesData = this.weeklyExpensesData.map((w) => w.amount);

      const realMax = Math.max(...seriesData, 0);
      const yAxisMax = Math.max(realMax, 30000);

      const now = new Date();
      const currentDay = now.getDay();
      const todayIndex = currentDay === 0 ? 6 : currentDay - 1;

      const colors = seriesData.map((_, index) =>
        index === todayIndex ? '#2563eb' : '#bfdbfe'
      );

      const options: ApexCharts.ApexOptions = {
        series: [{ name: 'Pengeluaran', data: seriesData }],
        chart: {
          type: 'bar',
          height: 160,
          toolbar: { show: false },
          sparkline: { enabled: false },
          fontFamily: 'inherit',
        },
        plotOptions: {
          bar: { borderRadius: 6, columnWidth: '40%', distributed: true },
        },
        colors: colors,
        dataLabels: { enabled: false },
        legend: { show: false },
        grid: {
          show: true,
          borderColor: '#e2e8f0',
          strokeDashArray: 4,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
        },
        xaxis: {
          categories: categories,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 },
          },
        },
        yaxis: {
          show: true,
          min: 0,
          max: yAxisMax,
          tickAmount: 2,
          labels: { show: false },
        },
        tooltip: {
          enabled: true,
          custom: ({ series, seriesIndex, dataPointIndex }) => {
            const val = series[seriesIndex][dataPointIndex];
            const dayLabel = categories[dataPointIndex][0];
            const dateLabel = categories[dataPointIndex][1];

            return `
              <div class="rounded-2xl border border-slate-800 bg-slate-900 p-2.5 shadow-2xl text-white font-sans text-xs">
                <div class="text-[10px] font-medium text-slate-400 mb-0.5">${dayLabel}, ${dateLabel} ${this.currentMonthName}</div>
                <div class="font-extrabold text-blue-400">Rp ${new Intl.NumberFormat('id-ID').format(val)}</div>
              </div>
            `;
          },
        },
      };

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      this.chartInstance = new ApexCharts(chartEl, options);
      this.chartInstance.render();
    },

    // ==========================================
    // 5. UI HANDLERS & HELPERS
    // ==========================================
    getCategoryIcon(item: any) {
      if (item.type === 'transfer') return 'wallet';
      if (item.categories?.icon) return item.categories.icon;
      const matched = this.categories.find((c) => c.id === item.category_id);
      return matched ? matched.icon || '' : '';
    },

    getCategoryName(item: any) {
      if (item.type === 'transfer') return 'Transfer';
      if (item.categories?.name) return item.categories.name;
      const matched = this.categories.find((c) => c.id === item.category_id);
      return matched ? matched.name : 'Umum';
    },

    getWalletName(item: any) {
      if (item.wallets?.name) return item.wallets.name;
      const matched = this.wallets.find((w) => w.id === item.wallet_id);
      return matched ? matched.name : 'Dompet';
    },

    handleCustomAmountInput(event: any) {
      const rawValue = event.target.value.replace(/[^0-9]/g, '');
      this.customQuickForm.amount = rawValue;
      event.target.value = this.formattedCustomAmount;
    },

    toggleReorderFeatures() {
      if (!this.isReorderingFeatures) {
        this.initialFeaturesJson = JSON.stringify(
          this.featuresList.map((f) => f.id)
        );
        this.isReorderingFeatures = true;
      } else {
        this.finishReorderFeatures();
      }
    },

    moveFeature(index: number, direction: 'up' | 'down') {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= this.featuresList.length) return;

      const updated = [...this.featuresList];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      this.featuresList = updated;
    },

    finishReorderFeatures() {
      const currentOrderJson = JSON.stringify(
        this.featuresList.map((f) => f.id)
      );
      if (currentOrderJson !== this.initialFeaturesJson) {
        localStorage.setItem('studion_features_order', currentOrderJson);
      }
      this.isReorderingFeatures = false;
    },

    closeFeatureModal() {
      if (this.isReorderingFeatures) {
        this.finishReorderFeatures();
      }
      this.openModal = false;
    },

    formatCurrency(val: number, type?: string) {
      return formatCurrency(val, type);
    },

    formatNumber(val: number) {
      if (!val) return '0';
      return new Intl.NumberFormat('id-ID').format(val);
    },

    // ==========================================
    // 6. QUICK TRANSACTIONS ACTIONS
    // ==========================================
    async saveAndExecCustomQuick() {
      if (!this.customQuickForm.notes.trim()) {
        return alert('Catatan / Nama Transaksi wajib diisi!');
      }
      if (
        !this.customQuickForm.amount ||
        Number(this.customQuickForm.amount) <= 0
      ) {
        return alert('Nominal transaksi harus diisi!');
      }
      if (!this.customQuickForm.wallet_id) {
        return alert('Pilih dompet terlebih dahulu!');
      }

      const newCustom: CustomQuickItem = {
        title: this.customQuickForm.notes.trim(),
        amount: Number(this.customQuickForm.amount),
        type: this.customQuickForm.type,
        wallet_id: this.customQuickForm.wallet_id,
        category_id: this.customQuickForm.category_id || undefined,
        isCustom: true,
      };

      this.customQuicks.unshift(newCustom);
      if (this.customQuicks.length > 5) {
        this.customQuicks = this.customQuicks.slice(0, 5);
      }
      localStorage.setItem(
        'studion_custom_quicks',
        JSON.stringify(this.customQuicks)
      );

      this.openCustomQuickModal = false;
      await this.quickAddInstant(newCustom);

      this.customQuickForm.notes = '';
      this.customQuickForm.amount = '';
    },

    async quickAddInstant(item: any) {
      if (this.isSubmittingQuick) return;

      const targetWalletId =
        item.wallet_id || (this.wallets.length > 0 ? this.wallets[0].id : '');
      if (!targetWalletId) {
        alert('Silakan buat dompet terlebih dahulu!');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const payload = {
        type: item.type || 'expense',
        amount: String(item.amount),
        wallet_id: targetWalletId,
        category_id: item.category_id || undefined,
        transaction_date: today,
        notes: item.title,
      };

      this.isSubmittingQuick = true;

      try {
        await apiClient.createTransaction(payload);
        await this.fetchData();

        this.toastMessage = `Berhasil mencatat "${item.title}"!`;
        this.showToast = true;
        setTimeout(() => {
          this.showToast = false;
        }, 2500);
      } catch (e: any) {
        console.error(e);
        alert(e.message || 'Terjadi kesalahan sistem.');
      } finally {
        this.isSubmittingQuick = false;
      }
    },
  };
}
