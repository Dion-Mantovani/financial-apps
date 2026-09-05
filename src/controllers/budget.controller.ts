import { apiClient } from '../services/apiClient';
import { formatCurrency, formatUltraCompact } from '../utils/formatters';
import { getCache, setCache } from '../utils/cache';
import type {
  BudgetItem,
  CategoryItem,
  TransactionItem,
  ProcessedBudgetItem,
} from '../utils/types';

export function budgetController() {
  return {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    selectedMonth: new Date().toISOString().slice(0, 7), // Format YYYY-MM
    loading: true,
    isSubmitting: false,

    budgets: [] as BudgetItem[],
    transactions: [] as TransactionItem[],
    categories: [] as CategoryItem[],
    hasPreviousMonthBudget: false,
    previousMonthPeriod: '',

    openModal: false,
    isEditMode: false,

    formData: {
      id: '',
      category_id: '',
      amount: '',
      period: '',
    },

    // ==========================================
    // 2. LIFECYCLE & SWR DATA FETCHING
    // ==========================================
    async init() {
      // Step 1: Instan dari LocalStorage Cache (0 ms)
      this.fetchDataFromCache();

      // Watcher saat bulan diubah via picker
      (this as any).$watch('selectedMonth', async () => {
        await this.fetchData();
      });

      // Step 2: Revalidate dari Server di Background
      await this.fetchData();
    },

    fetchDataFromCache() {
      const cachedBudgets = getCache<BudgetItem[]>(
        `studion_cache_budgets_${this.selectedMonth}`
      );
      const cachedTransactions = getCache<TransactionItem[]>(
        'studion_cache_transactions'
      );
      const cachedCategories = getCache<CategoryItem[]>(
        'studion_cache_categories'
      );

      if (cachedBudgets) this.budgets = cachedBudgets;
      if (cachedTransactions) this.transactions = cachedTransactions;
      if (cachedCategories) this.categories = cachedCategories;

      if (cachedBudgets || cachedTransactions || cachedCategories) {
        this.loading = false;
      }
    },

    async fetchData() {
      if (this.budgets.length === 0) {
        this.loading = true;
      }

      try {
        const [rawBudgets, rawTransactions, rawCategories] = await Promise.all([
          apiClient.getBudgets<BudgetItem[]>(this.selectedMonth),
          apiClient.getTransactions<TransactionItem[]>(),
          apiClient.getCategories<CategoryItem[]>(),
        ]);

        this.budgets = rawBudgets;
        this.transactions = rawTransactions;
        this.categories = rawCategories;

        setCache(`studion_cache_budgets_${this.selectedMonth}`, rawBudgets);
        setCache('studion_cache_transactions', rawTransactions);
        setCache('studion_cache_categories', rawCategories);

        // Cek ketersediaan budget bulan sebelumnya jika bulan ini masih kosong
        if (this.budgets.length === 0) {
          await this.checkPreviousMonthBudget();
        }
      } catch (e) {
        console.error('SWR Revalidate Budget Failed:', e);
      } finally {
        this.loading = false;
      }
    },

    async checkPreviousMonthBudget() {
      const [year, month] = this.selectedMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      try {
        const prevBudgets =
          await apiClient.getBudgets<BudgetItem[]>(prevPeriod);
        if (prevBudgets && prevBudgets.length > 0) {
          this.hasPreviousMonthBudget = true;
          this.previousMonthPeriod = prevPeriod;
        } else {
          this.hasPreviousMonthBudget = false;
        }
      } catch (e) {
        this.hasPreviousMonthBudget = false;
      }
    },

    // ==========================================
    // 3. COMPUTED & CALCULATIONS
    // ==========================================
    get processedBudgets(): ProcessedBudgetItem[] {
      return this.budgets.map((budget) => {
        const catId = budget.category_id;
        const allocated = Number(budget.amount || 0);

        // Total pengeluaran kategori ini di bulan yang dipilih
        const spent = this.transactions
          .filter((t) => {
            const txDate = t.transaction_date
              ? t.transaction_date.split('T')[0]
              : '';
            return (
              t.type === 'expense' &&
              t.category_id === catId &&
              txDate.startsWith(this.selectedMonth)
            );
          })
          .reduce((acc, t) => acc + Number(t.amount || 0), 0);

        const remaining = allocated - spent;
        const percentage =
          allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

        let status: 'safe' | 'warning' | 'exceeded' = 'safe';
        let barColor = 'bg-blue-600';
        let badgeColor = 'bg-blue-50 text-blue-600 border-blue-200';
        let iconColor = 'text-blue-600 bg-blue-50 border-blue-100';

        if (percentage >= 100) {
          status = 'exceeded';
          barColor = 'bg-rose-600';
          badgeColor = 'bg-rose-50 text-rose-600 border-rose-200';
          iconColor = 'text-rose-600 bg-rose-50 border-rose-100';
        } else if (percentage >= 80) {
          status = 'warning';
          barColor = 'bg-amber-500';
          badgeColor = 'bg-amber-50 text-amber-600 border-amber-200';
          iconColor = 'text-amber-600 bg-amber-50 border-amber-100';
        } else {
          status = 'safe';
          barColor = 'bg-emerald-500';
          badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200';
          iconColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
        }

        const categoryObj =
          budget.categories || this.categories.find((c) => c.id === catId);

        return {
          ...budget,
          categories: categoryObj,
          spent,
          remaining,
          percentage,
          status,
          barColor,
          badgeColor,
          iconColor,
        };
      });
    },

    get totalAllocated() {
      return this.budgets.reduce((acc, b) => acc + Number(b.amount || 0), 0);
    },

    get totalSpent() {
      return this.processedBudgets.reduce((acc, b) => acc + b.spent, 0);
    },

    get totalRemaining() {
      return this.totalAllocated - this.totalSpent;
    },

    get overallPercentage() {
      if (this.totalAllocated === 0) return 0;
      const pct = Math.round((this.totalSpent / this.totalAllocated) * 100);
      return Math.min(pct, 100);
    },

    get warningLimitCount() {
      return this.processedBudgets.filter(
        (b) => b.status === 'warning' || b.status === 'exceeded'
      ).length;
    },

    get formattedSelectedMonth() {
      const [year, month] = this.selectedMonth.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    },

    get availableCategoriesForBudget() {
      // Hanya kategori tipe 'expense' yang BELUM dibuatkan budget di bulan ini
      return this.categories.filter((c) => {
        if (c.type !== 'expense') return false;
        if (this.isEditMode && c.id === this.formData.category_id) return true;
        return !this.budgets.some((b) => b.category_id === c.id);
      });
    },

    get formattedFormAmount() {
      if (!this.formData.amount) return '';
      const num = parseInt(this.formData.amount, 10);
      if (isNaN(num)) return '';
      return new Intl.NumberFormat('id-ID').format(num);
    },

    // ==========================================
    // 4. UI HANDLERS & MODAL LOGIC
    // ==========================================
    openMonthPicker() {
      const input = (this as any).$refs.monthInput;
      if (input) {
        if ('showPicker' in HTMLInputElement.prototype) {
          input.showPicker();
        } else {
          input.click();
        }
      }
    },

    handleAmountInput(event: any) {
      const rawValue = event.target.value.replace(/[^0-9]/g, '');
      this.formData.amount = rawValue;
      event.target.value = this.formattedFormAmount;
    },

    openAddModal() {
      const available = this.availableCategoriesForBudget;
      if (available.length === 0) {
        return alert('Semua kategori pengeluaran sudah memiliki budget!');
      }

      this.isEditMode = false;
      this.formData = {
        id: '',
        category_id: available[0].id,
        amount: '',
        period: this.selectedMonth,
      };
      this.openModal = true;
    },

    openEditModal(item: ProcessedBudgetItem) {
      this.isEditMode = true;
      this.formData = {
        id: item.id || '',
        category_id: item.category_id,
        amount: String(item.amount),
        period: item.period || this.selectedMonth,
      };
      this.openModal = true;
    },

    formatCurrency(val: number) {
      return formatCurrency(val);
    },

    formatUltraCompact(val: number) {
      return formatUltraCompact(val);
    },

    // Helper pemetaan ikon kategori
    getCategoryIconName(categoryObj: any) {
      if (!categoryObj || !categoryObj.icon) return 'Grid';
      return categoryObj.icon; // Mengembalikan string nama ikon dari DB (misal: Utensils, ShoppingBag, Fuel, etc)
    },

    // ==========================================
    // 5. API ACTIONS (SAVE, DELETE, COPY)
    // ==========================================
    async saveBudget() {
      if (!this.formData.category_id) {
        return alert('Pilih kategori terlebih dahulu!');
      }
      if (!this.formData.amount || Number(this.formData.amount) <= 0) {
        return alert('Nominal anggaran harus diisi!');
      }

      this.isSubmitting = true;
      try {
        const payload = {
          id: this.formData.id || undefined,
          category_id: this.formData.category_id,
          amount: Number(this.formData.amount),
          period: this.selectedMonth,
        };

        if (this.isEditMode) {
          await apiClient.updateBudget(payload);
        } else {
          await apiClient.createBudget(payload);
        }

        this.openModal = false;
        await this.fetchData();
      } catch (e: any) {
        alert(e.message || 'Gagal menyimpan anggaran!');
      } finally {
        this.isSubmitting = false;
      }
    },

    async deleteBudget() {
      if (!confirm('Yakin mau menghapus anggaran kategori ini?')) return;

      this.isSubmitting = true;
      try {
        await apiClient.deleteBudget(this.formData.id);
        this.openModal = false;
        await this.fetchData();
      } catch (e: any) {
        alert(e.message || 'Gagal menghapus anggaran!');
      } finally {
        this.isSubmitting = false;
      }
    },

    async copyPreviousBudget() {
      if (!this.hasPreviousMonthBudget || !this.previousMonthPeriod) return;

      if (
        !confirm(
          `Salin seluruh alokasi anggaran dari bulan ${this.previousMonthPeriod}?`
        )
      ) {
        return;
      }

      this.isSubmitting = true;
      try {
        await apiClient.copyPreviousBudget({
          fromPeriod: this.previousMonthPeriod,
          toPeriod: this.selectedMonth,
        });
        await this.fetchData();
      } catch (e: any) {
        alert(e.message || 'Gagal menyalin anggaran bulan sebelumnya!');
      } finally {
        this.isSubmitting = false;
      }
    },
  };
}
