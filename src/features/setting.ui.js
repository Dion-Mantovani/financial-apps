import { appStore } from '../stores/app.store.js';
import { importLegacyData } from '../services/import.service.js';

export function settingUI() {
  return {
    activeModal: null,
    darkMode: false,
    notif: true,
    feedbackText: '',

    // State Import Data
    selectedImportFile: null,
    importFileName: '',
    isImporting: false,

    isLoading: false,
    selectedFile: null, // Menyimpan File object
    parsedPayload: null, // Menyimpan data JSON yang sudah di-parse
    fileSummary: null,

    // Sync Manual via App Store
    async handleManualSync() {
      try {
        await appStore.triggerSync();
      } catch (err) {
        alert('Gagal melakukan sinkronisasi ke server.');
      }
    },

    openModal(modalName) {
      this.activeModal = modalName;
    },

    // Modal Manager
    closeModal() {
      // Reset activeModal ke boolean false atau null (bukan string 'false')
      this.activeModal = false; // atau: this.activeModal = null;

      // Reset form import & variabel state
      this.resetImportForm();
    },

    resetImportForm() {
      this.selectedFile = null;
      this.parsedPayload = null;
      this.fileSummary = null;
      this.isLoading = false;

      // Clear input element file jika ada
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';
    },

    // Event Handler Upload File
    handleFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedImportFile = file;
        this.importFileName = file.name;
      }
    },

    // Process Import Data File
    async processImport() {
      if (!this.selectedImportFile) return;

      this.isImporting = true;
      try {
        console.log('Memproses file import:', this.selectedImportFile.name);

        // Simulasi delay (Nanti disambung ke parser & transactionStore)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        alert('Data berhasil di-import!');
        this.closeModal();
      } catch (err) {
        console.error('[Import Error]:', err);
        alert('Gagal meng-import file data.');
      } finally {
        this.isImporting = false;
      }
    },

    // Handle saat file dipilih via input file / dropzone
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const payload = JSON.parse(e.target.result);

          // Validasi struktur JSON
          if (
            !payload.accounts ||
            !payload.categories ||
            !payload.transactions
          ) {
            alert(
              'File JSON tidak valid! Pastikan struktur accounts, categories, dan transactions tersedia.'
            );
            this.resetFile(event.target);
            return;
          }

          // Simpan ke state Alpine
          this.selectedFile = file;
          this.parsedPayload = payload;
          this.fileSummary = {
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(1) + ' KB',
            accountsCount: payload.accounts.length,
            categoriesCount: payload.categories.length,
            transactionsCount: payload.transactions.length,
          };
        } catch (err) {
          console.error('[Import JSON Error]:', err);
          alert('Gagal membaca file JSON. Format file rusak!');
          this.resetFile(event.target);
        }
      };

      reader.readAsText(file);
    },

    // Handle tombol "Mulai Import"
    async executeImport() {
      if (!this.parsedPayload) return;

      this.isLoading = true;

      try {
        // Pastikan mengoper Un-proxied Object ke service import
        const rawData = JSON.parse(JSON.stringify(this.parsedPayload));

        await importLegacyData(rawData);

        // Refresh store setelah import selesai
        if (window.accountStore) await window.accountStore.loadAccounts();
        if (window.categoryStore) await window.categoryStore.loadCategories();
        if (window.transactionStore)
          await window.transactionStore.loadTransactions();

        alert('Berhasil mengimpor data!');
        this.closeModal();
      } catch (err) {
        console.error('[Import Error]:', err);
        alert('Gagal mengimpor data: ' + err.message);
      } finally {
        this.isLoading = false;
      }
    },

    // Reset state
    resetFile(inputEl = null) {
      this.selectedFile = null;
      this.parsedPayload = null;
      this.fileSummary = null;
      if (inputEl) inputEl.value = '';
    },

    async submitProfile() {
      this.closeModal();
    },

    async submitPassword() {
      this.closeModal();
    },

    async submitFeedback() {
      if (!this.feedbackText.trim()) return;
      this.feedbackText = '';
      this.closeModal();
    },

    async handleLogout() {
      this.closeModal();
    },

    async handleResetData() {
      this.closeModal();
    },

    async handleDeleteAccount() {
      this.closeModal();
    },
  };
}
