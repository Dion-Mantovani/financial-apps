// src/controllers/analytics.controller.ts
import { apiClient } from '../services/apiClient';
import { formatCurrency, formatUltraCompact } from '../utils/formatters';
import { getCache, setCache } from '../utils/cache'; // Import helper cache sesuai pattern budgetController
import type { AnalyticsResponse } from '../utils/types';
import ApexCharts from 'apexcharts';

export function analyticsController() {
  return {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    selectedMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    period: 'monthly', // 'weekly' | 'monthly' | 'yearly'
    chartType: 'area', // 'area' | 'bar' | 'radar'
    matrixTab: 'core', // 'core' | 'behavior' | 'projection'
    loading: true,
    showGlossaryModal: false,
    chartInstance: null as ApexCharts | null,

    glossaryItems: [
      // TAB UTAMA (CORE)
      {
        term: 'Burn Rate Harian',
        desc: 'Rata-rata estimasi uang pengeluaran yang kamu bakar per harinya dalam periode ini.',
        icon: 'flame',
      },
      {
        term: 'Jatah Jajan Harian',
        desc: 'Batas maksimal pengeluaran aman per hari agar sisa anggaran tidak habis sebelum akhir periode.',
        icon: 'wallet',
      },
      {
        term: 'Skor Kesehatan',
        desc: 'Indikator performa finansial berdasarkan konsistensi saving rate dan batas anggaran.',
        icon: 'activity',
      },
      {
        term: 'Kepatuhan Anggaran',
        desc: 'Persentase kedisiplinan kamu dalam menjaga pengeluaran agar tetap di bawah batas target.',
        icon: 'shield-check',
      },

      // TAB PERILAKU (BEHAVIOR)
      {
        term: 'Transaksi Tertinggi',
        desc: 'Nominal pengeluaran tunggal paling besar yang kamu catat dalam periode aktif.',
        icon: 'arrow-up-right',
      },
      {
        term: 'Total Transaksi',
        desc: 'Jumlah frekuensi intensitas kamu melakukan pencatatan transaksi belanja/masuk.',
        icon: 'receipt',
      },
      {
        term: 'Kategori Teratas',
        desc: 'Kategori belanja yang paling banyak menyerap porsi anggaranmu.',
        icon: 'tag',
      },
      {
        term: 'Rata-rata Transaksi',
        desc: 'Estimasi rata-rata nominal uang yang kamu keluarkan dalam setiap kali bertransaksi.',
        icon: 'calculator',
      },

      // TAB PROYEKSI (PROJECTION)
      {
        term: 'Proyeksi Akhir Periode',
        desc: 'Estimasi sisa kas bersih yang akan kamu miliki saat periode berakhir.',
        icon: 'trending-up',
      },
      {
        term: 'Daya Tahan Saldo',
        desc: 'Estimasi berapa hari sisa saldomu mampu bertahan berdasarkan kecepatan burn rate harian.',
        icon: 'clock',
      },
      {
        term: 'Potensi Hemat AI',
        desc: 'Estimasi jumlah uang yang bisa kamu selamatkan jika memotong belanja impulsif.',
        icon: 'sparkles',
      },
      {
        term: 'Target Investasi',
        desc: 'Rekomendasi nominal ideal (20% dari pemasukan) untuk dialokasikan ke instrumen investasi.',
        icon: 'piggy-bank',
      },
    ],

    data: {
      summary: {
        income: 0,
        expense: 0,
        netCashflow: 0,
        expenseRatio: 0,
        incomeDiffPercentage: 0,
        expenseDiffPercentage: 0,
        savingRate: 0,
      },
      chartData: {
        labels: ['Mg 1', 'Mg 2', 'Mg 3', 'Mg 4'],
        incomeData: [0, 0, 0, 0],
        expenseData: [0, 0, 0, 0],
      },
      topCategories: [],
      aiInsight: 'Memuat insight keuangan...',
      recommendation: 'Memuat rekomendasi...',
      matrixMetrics: {
        core: [],
        behavior: [],
        projection: [],
      },
    } as AnalyticsResponse,

    // ==========================================
    // 2. LIFECYCLE & SWR DATA FETCHING
    // ==========================================
    async init() {
      this.fetchDataFromCache(); // Load cache[cite: 5]

      (this as any).$watch('selectedMonth', async () => {
        this.fetchDataFromCache(); //[cite: 5]
        await this.fetchAnalytics();
      });

      (this as any).$watch('period', async () => {
        this.fetchDataFromCache(); //[cite: 5]
        await this.fetchAnalytics();
      });

      // WATCHER CHART TYPE DENGAN NEXT TICK (BIAR CONTAINER HTML-NYA KETEMU)
      (this as any).$watch('chartType', (type: string) => {
        (this as any).$nextTick(() => {
          setTimeout(() => {
            if (type === 'area') this.renderApexAreaChart();
            if (type === 'bar') this.renderApexBarChart();
          }, 100);
        });
      });

      (this as any).$watch('period', (newPeriod: string) => {
        // Jika user sedang di tab donut/radar tapi switch ke mingguan, otomatis pindahkan ke area chart
        if (newPeriod === 'weekly' && this.chartType === 'radar') {
          this.chartType = 'area';
        }
        this.fetchDataFromCache();
        this.fetchAnalytics();
      });

      (this as any).$watch('chartType', (type: string) => {
        (this as any).$nextTick(() => {
          setTimeout(() => {
            if (type === 'area') this.renderApexAreaChart();
            if (type === 'bar') this.renderApexBarChart();
            if (type === 'radar') this.renderApexDonutChart();
          }, 100);
        });
      });

      await this.fetchAnalytics();
    },

    fetchDataFromCache() {
      const cacheKey = `studion_cache_analytics_${this.period}_${this.selectedMonth}`;
      const cachedData = getCache<AnalyticsResponse>(cacheKey);

      if (cachedData) {
        this.data = cachedData;
        this.loading = false;

        // Render grafik instan dari cache tanpa nunggu API
        if (this.chartType === 'area') {
          setTimeout(() => this.renderApexAreaChart(), 10);
        }
      }
    },

    async fetchAnalytics() {
      const cacheKey = `studion_cache_analytics_${this.period}_${this.selectedMonth}`;
      const hasCache = !!getCache<AnalyticsResponse>(cacheKey);

      // Hanya tampilkan status/indicator loading jika BELUM ada cache sama sekali
      if (!hasCache) {
        this.loading = true;
      }

      try {
        const res = await apiClient.getAnalytics<AnalyticsResponse>(
          this.period,
          `${this.selectedMonth}-01`
        );
        if (res) {
          this.data = res;
          setCache(cacheKey, res);

          // Trigger render sesuai tab aktif
          (this as any).$nextTick(() => {
            setTimeout(() => {
              if (this.chartType === 'area') this.renderApexAreaChart();
              if (this.chartType === 'bar') this.renderApexBarChart();
            }, 100);
          });
        }
      } catch (e) {
        console.error('SWR Revalidate Analytics Failed:', e);
      } finally {
        this.loading = false;
      }
    },

    // ==========================================
    // 3. APEXCHARTS AREA RENDERER
    // ==========================================
    renderApexAreaChart() {
      const container = document.querySelector(
        '#apex-area-chart'
      ) as HTMLElement | null;
      if (!container) return;

      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }

      const options: ApexCharts.ApexOptions = {
        series: [
          {
            name: 'Pemasukan',
            data: this.data.chartData.incomeData || [],
          },
          {
            name: 'Pengeluaran',
            data: this.data.chartData.expenseData || [],
          },
        ],
        chart: {
          type: 'area',
          height: 170,
          toolbar: { show: false },
          sparkline: { enabled: false },
          background: 'transparent',
          parentHeightOffset: 0,
        },
        colors: ['#38bdf8', '#f43f5e'],
        dataLabels: { enabled: false },
        stroke: {
          curve: 'smooth',
          width: 2.5,
        },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.4,
            opacityTo: 0.0,
            stops: [0, 90, 100],
          },
        },
        grid: {
          show: true,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          strokeDashArray: 3,
          padding: {
            left: 10,
            right: 10,
            top: -15,
            bottom: -5,
          },
        },
        xaxis: {
          categories: this.data.chartData.labels || [],
          labels: {
            style: {
              colors: 'rgba(186, 230, 253, 0.6)',
              fontSize: '9px',
              fontWeight: 600,
            },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          show: false,
        },
        legend: {
          show: false,
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const income = series[0][dataPointIndex];
            const expense = series[1][dataPointIndex];
            const label = w.globals.categoryLabels[dataPointIndex];

            return `
              <div class="rounded-2xl border border-white/20 bg-slate-900/95 p-2.5 shadow-xl backdrop-blur-md text-[10px] space-y-1">
                <div class="font-extrabold text-slate-300 pb-1 border-b border-white/10">${label}</div>
                <div class="flex items-center justify-between gap-3 text-cyan-300 font-bold">
                  <span>Masuk:</span>
                  <span>Rp ${new Intl.NumberFormat('id-ID').format(income)}</span>
                </div>
                <div class="flex items-center justify-between gap-3 text-rose-400 font-bold">
                  <span>Keluar:</span>
                  <span>Rp ${new Intl.NumberFormat('id-ID').format(expense)}</span>
                </div>
              </div>
            `;
          },
        },
      };

      this.chartInstance = new ApexCharts(container, options);
      this.chartInstance.render();
    },

    renderApexBarChart() {
      const container = document.querySelector(
        '#apex-bar-chart'
      ) as HTMLElement | null;
      if (!container) return;

      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }

      const stackedData = this.data.stackedBarData || {
        labels: ['P1', 'P2', 'P3'],
        series: [],
      };

      const categoryColors = stackedData.series.map(
        (s) => s.color || '#3b82f6'
      );

      // Skala Proyeksi Visual Damp
      const visualSeries = stackedData.series.map((s) => ({
        name: s.name,
        data: s.data.map((val) =>
          val > 0 ? Math.round(Math.sqrt(val) * 10) : 0
        ),
        rawValues: s.data,
      }));

      const options: ApexCharts.ApexOptions = {
        series: visualSeries,
        chart: {
          type: 'bar',
          height: 170,
          stacked: true,
          toolbar: { show: false },
          background: 'transparent',
          parentHeightOffset: 0,
        },
        colors: categoryColors,
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '38%',
            borderRadius: 8,
            borderRadiusApplication: 'end',
          },
        },
        dataLabels: { enabled: false },
        stroke: {
          width: 1.5,
          colors: ['#0f172a'],
        },
        grid: {
          show: true,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          strokeDashArray: 3,
          padding: { left: 10, right: 10, top: -15, bottom: -5 },
        },
        xaxis: {
          categories: stackedData.labels,
          labels: {
            style: {
              colors: 'rgba(186, 230, 253, 0.6)',
              fontSize: '9px',
              fontWeight: 600,
            },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: { show: false },
        legend: { show: false },
        // PERBAIKAN TOOLTIP: Mencegah Terpotong & Fix 'undefined'
        tooltip: {
          enabled: true,
          shared: false,
          followCursor: true,
          intersect: true,
          custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const categoryName = w.globals.seriesNames[seriesIndex];
            const periodLabel = stackedData.labels[dataPointIndex] || '';

            const configSeries = w.config.series as any[];
            const currentSeries = configSeries?.[seriesIndex];
            const rawValue = currentSeries?.rawValues?.[dataPointIndex] || 0;

            let totalRawPeriod = 0;
            if (configSeries && Array.isArray(configSeries)) {
              for (let i = 0; i < configSeries.length; i++) {
                totalRawPeriod +=
                  configSeries[i]?.rawValues?.[dataPointIndex] || 0;
              }
            }

            const percentage =
              totalRawPeriod > 0
                ? Math.round((rawValue / totalRawPeriod) * 100)
                : 0;
            const color = categoryColors[seriesIndex];

            return `
              <div class="z-50 rounded-xl border border-white/20 bg-slate-900/95 px-2 py-1.5 shadow-2xl backdrop-blur-md text-[9px] space-y-0.5 pointer-events-none max-w-[130px]">
                <div class="flex items-center gap-1 pb-0.5 border-b border-white/10">
                  <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background-color: ${color}"></span>
                  <span class="font-extrabold text-slate-200 truncate">${categoryName}</span>
                  ${periodLabel ? `<span class="text-[8px] text-slate-400 shrink-0">(${periodLabel})</span>` : ''}
                </div>
                <div class="flex items-center justify-between gap-2 font-bold text-white pt-0.5">
                  <span class="text-slate-400">Total:</span>
                  <span>Rp ${new Intl.NumberFormat('id-ID').format(rawValue)}</span>
                </div>
                <div class="flex items-center justify-between gap-2 text-cyan-300 font-bold">
                  <span class="text-slate-400">Porsi:</span>
                  <span>${percentage}%</span>
                </div>
              </div>
            `;
          },
        },
      };

      this.chartInstance = new ApexCharts(container, options);
      this.chartInstance.render();
    },

    renderApexDonutChart() {
      const container = document.querySelector(
        '#apex-donut-chart'
      ) as HTMLElement | null;
      if (!container) return;

      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }

      const donutData = (this.data as any).donutData || {
        labels: [],
        series: [],
        colors: [],
      };

      // Fallback jika belum ada transaksi pengeluaran
      const series = donutData.series.length > 0 ? donutData.series : [1];
      const labels =
        donutData.labels.length > 0
          ? donutData.labels
          : ['Belum ada pengeluaran'];
      const colors =
        donutData.colors.length > 0 ? donutData.colors : ['#334155'];

      const options: ApexCharts.ApexOptions = {
        series: series,
        labels: labels,
        chart: {
          type: 'donut',
          height: 170,
          toolbar: { show: false },
          background: 'transparent',
        },
        colors: colors,
        stroke: {
          width: 2,
          colors: ['#0f172a'],
        },
        plotOptions: {
          pie: {
            donut: {
              size: '72%',
              labels: {
                show: true,
                name: {
                  show: true,
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#94a3b8',
                },
                value: {
                  show: true,
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#ffffff',
                  formatter: (val: string) => {
                    const num = Number(val);
                    return isNaN(num) || num === 1
                      ? 'Rp 0'
                      : `Rp ${new Intl.NumberFormat('id-ID').format(num)}`;
                  },
                },
                total: {
                  show: true,
                  label: 'Total Keluar',
                  color: '#38bdf8',
                  fontSize: '9px',
                  fontWeight: 700,
                  formatter: (w) => {
                    const total = w.globals.seriesTotals.reduce(
                      (a: number, b: number) => a + b,
                      0
                    );
                    return total === 1 && labels[0] === 'Belum ada pengeluaran'
                      ? 'Rp 0'
                      : `Rp ${new Intl.NumberFormat('id-ID').format(total)}`;
                  },
                },
              },
            },
          },
        },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: {
          enabled: true,
          custom: ({ series, seriesIndex, w }) => {
            const categoryName = w.globals.labels[seriesIndex];

            // Cast ke Number untuk memastikan tipe data angka
            const rawValue = Number(series[seriesIndex] || 0);

            const total = Number(
              w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)
            );

            // Hitung persentase dengan aman
            const percentage =
              total > 0 ? Math.round((rawValue / total) * 100) : 0;
            const color = colors[seriesIndex] || '#38bdf8';

            return `
              <div class="z-50 rounded-xl border border-white/20 bg-slate-900/95 px-2.5 py-2 shadow-2xl backdrop-blur-md text-[9px] space-y-1 pointer-events-none max-w-[140px]">
                <div class="flex items-center gap-1.5 pb-1 border-b border-white/10">
                  <span class="h-2 w-2 rounded-full shrink-0" style="background-color: ${color}"></span>
                  <span class="font-extrabold text-slate-200 truncate">${categoryName}</span>
                </div>
                <div class="flex items-center justify-between gap-2 font-bold text-white pt-0.5">
                  <span class="text-slate-400">Nominal:</span>
                  <span>Rp ${new Intl.NumberFormat('id-ID').format(rawValue)}</span>
                </div>
                <div class="flex items-center justify-between gap-2 text-cyan-300 font-bold">
                  <span class="text-slate-400">Porsi:</span>
                  <span>${percentage}%</span>
                </div>
              </div>
            `;
          },
        },
      };

      this.chartInstance = new ApexCharts(container, options);
      this.chartInstance.render();
    },

    // ==========================================
    // 4. COMPUTED & HELPERS
    // ==========================================
    get formattedSelectedMonth() {
      const [year, month] = this.selectedMonth.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    },

    getBarHeight(val: number, isIncome: boolean) {
      const incomeArr = this.data.chartData.incomeData || [];
      const expenseArr = this.data.chartData.expenseData || [];
      const max = Math.max(...incomeArr, ...expenseArr, 1);
      return Math.max(12, Math.round((val / max) * 100));
    },

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

    formatCurrency(val: number) {
      return formatCurrency(val);
    },

    formatUltraCompact(val: number) {
      return formatUltraCompact(val);
    },
  };
}
