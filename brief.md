# Rencana Migrasi Arsitektur Local-First & Struktur Folder

## 1. Timing Perubahan Arsitektur

Perubahan arsitektur **belum dilakukan sekarang**.

Sebelum masuk ke pekerjaan migrasi:

1. Selesaikan terlebih dahulu seluruh fitur yang saat ini sudah masuk checklist development.
2. Pastikan fitur-fitur tersebut berjalan sesuai requirement.
3. Commit seluruh perubahan yang sudah selesai.
4. Push ke branch utama sebagai baseline yang stabil.
5. Setelah baseline aman, buat branch baru khusus untuk eksperimen/migrasi arsitektur.
6. Development arsitektur baru dilakukan sepenuhnya di branch tersebut.
7. Jika hasil migrasi sudah stabil dan lolos pengujian, merge branch migrasi ke branch utama.
8. Setelah merge, development berikutnya kembali dilakukan dari branch utama.

Tujuannya adalah supaya versi sebelum migrasi tetap aman dan dapat dijadikan titik kembali apabila migrasi mengalami masalah.

---

# 2. Perubahan Konsep Arsitektur

Arsitektur sebelumnya menggunakan pola:

```bash
User Action
    ↓
Alpine State
    ↓
IndexedDB
    ↓
langsung sync ke Supabase
```

Artinya hampir setiap perubahan data dapat menyebabkan request ke Supabase.

Arsitektur baru akan menggunakan pendekatan **local-first**:

```bash
User Action
    ↓
Alpine Store
    ↓
IndexedDB
    ↓
SELESAI
```

Supabase tidak perlu diakses setiap kali user melakukan perubahan.

Sinkronisasi dilakukan melalui dua trigger:

```bash
                 Sync
                  │
          ┌───────┴────────┐
          ↓                ↓
      Automatic          Manual
          │                │
          └───────┬────────┘
                  ↓
             Supabase
```

Automatic sync akan dijalankan berdasarkan jadwal yang ditentukan, misalnya sekitar pukul 22:00 ketika aplikasi aktif.

Manual sync dilakukan ketika user menekan tombol Sync, misalnya ketika ingin memastikan data dari satu device sudah tersedia di device lain.

---

# 3. Struktur Folder Baru

Struktur folder sengaja dibuat sederhana.

Tidak perlu terlalu banyak layer atau file selama project masih relatif kecil.

```bash
src/
│
├── pages/
│
├── components/
│
├── stores/
│   ├── app.store.js
│   ├── account.store.js
│   ├── category.store.js
│   └── transaction.store.js
│
├── data/
│   ├── indexeddb.js
│   └── supabase.js
│
├── services/
│   └── sync.service.js
│
├── lib/
│   └── helpers.js
│
└── styles/
    └── global.css
```

## Prinsip sederhana setiap folder

### `pages/`

Halaman aplikasi.

Tidak menangani langsung logic database.

### `components/`

UI/component yang digunakan oleh halaman.

Tidak menangani langsung logic database.

### `stores/`

Logic aplikasi dan state Alpine.

Contoh:

```bash
account.store.js
→ logic account

category.store.js
→ logic category

transaction.store.js
→ logic transaction

app.store.js
→ state global aplikasi dan status sync
```

Store menangani apa yang dilakukan aplikasi, tetapi tidak langsung berkomunikasi dengan Supabase.

### `data/`

Semua akses data.

```bash
indexeddb.js
→ local database

supabase.js
→ server database
```

IndexedDB akan menjadi local working database.

Supabase menjadi persistent server database.

### `services/`

Proses yang melibatkan beberapa bagian aplikasi.

Untuk tahap ini hanya diperlukan:

```bash
sync.service.js
```

File ini menangani:

- manual sync
- automatic sync
- push local changes
- pull server changes
- sync status
- pending changes
- proses sinkronisasi secara keseluruhan

Tidak perlu membuat `sync-engine.service.js` terpisah untuk saat ini.

### `lib/`

Utility/helper umum yang tidak termasuk state, database, atau sync.

---

# 4. Struktur IndexedDB

Walaupun hanya ada satu file:

```bash
data/indexeddb.js
```

IndexedDB tetap dapat memiliki beberapa object store:

```bash
IndexedDB
│
├── accounts
├── categories
├── transactions
└── sync_queue
```

`sync_queue` digunakan untuk mengetahui perubahan lokal yang belum dikirim ke Supabase.

Contoh konsep:

```bash
transactions
    ↓
transaksi baru tersimpan secara lokal

sync_queue
    ↓
mencatat bahwa transaksi tersebut
masih membutuhkan sinkronisasi
```

Tidak perlu membuat `sync-queue.db.js` terpisah pada tahap awal.

Jika implementasinya nanti menjadi terlalu besar, baru dipertimbangkan pemisahan file.

---

# 5. Alur Perubahan Data

Contoh user menambahkan transaksi:

```bash
Transaction Page
      ↓
transaction.store.js
      ↓
indexeddb.js
      ↓
IndexedDB
      ↓
sync_queue
```

Tidak ada request Supabase pada saat user menyimpan transaksi.

User langsung mendapatkan respons dari local database sehingga aplikasi terasa cepat.

---

# 6. Alur Manual Sync

Ketika user menekan tombol Sync:

```bash
User
 ↓
Sync button
 ↓
sync.service.js
 ↓
ambil pending changes dari IndexedDB
 ↓
push ke Supabase
 ↓
pull perubahan dari Supabase
 ↓
update IndexedDB
 ↓
update Alpine State
 ↓
Sync selesai
```

Manual sync diperlukan terutama untuk kebutuhan seperti:

```bash
Device A
   ↓
melakukan perubahan
   ↓
Sync
   ↓
Supabase
   ↓
Device B
   ↓
Manual Sync
   ↓
mendapatkan perubahan terbaru
```

---

# 7. Alur Automatic Sync

Automatic sync tidak berarti browser harus dipaksa menjalankan JavaScript tepat pada pukul 22:00.

Browser tidak menjamin website tetap aktif ketika browser ditutup atau device tidak aktif.

Karena itu mekanismenya lebih aman dibuat seperti:

```bash
Aplikasi aktif
     ↓
cek waktu terakhir sync
     ↓
apakah sudah melewati jadwal automatic sync?
     ↓
      Ya
      ↓
jalankan sync.service.js
```

Jika tidak ada perubahan:

```bash
pending changes = 0
        ↓
tidak perlu push data
```

Jadi tidak perlu melakukan operasi database yang tidak diperlukan hanya karena jadwal automatic sync telah tiba.

---

# 8. Status Sinkronisasi

Aplikasi sebaiknya memiliki status sync yang jelas.

Contoh:

```bash
✓ Synced
```

```bash
↻ Syncing...
```

```bash
3 changes pending
```

```bash
⚠ Sync failed
```

Status tersebut dapat dikelola melalui `app.store.js`.

User harus bisa mengetahui apakah data lokal sudah tersinkron atau masih memiliki perubahan yang menunggu sync.

---

# 9. Prinsip Utama Arsitektur

Tetapkan aturan sederhana:

```bash
Component
    ↓
Store
    ↓
IndexedDB
```

untuk operasi aplikasi sehari-hari.

Sedangkan:

```bash
Manual / Automatic Trigger
          ↓
    sync.service.js
          ↓
     supabase.js
          ↓
       Supabase
```

untuk sinkronisasi.

Dengan demikian:

- Component tidak langsung mengakses database.
- Store tidak langsung mengakses Supabase.
- Supabase tidak dipanggil setiap kali ada perubahan lokal.
- Logic sync tidak tersebar ke berbagai store.
- Tidak membuat terlalu banyak layer sebelum benar-benar dibutuhkan.

---

# 10. Prinsip Pengembangan

Jangan melakukan overengineering sejak awal.

Gunakan aturan:

> Satu file dibuat terpisah hanya jika memang ada alasan yang jelas untuk memisahkannya.

Contohnya tidak perlu langsung membuat:

```bash
accounts.db.js
categories.db.js
transactions.db.js
sync-queue.db.js
sync-engine.service.js
supabase.service.js
repository/
adapters/
providers/
```

Semua itu bisa dibuat nanti jika kompleksitas project memang sudah membutuhkannya.

Untuk tahap sekarang, struktur yang lebih sederhana lebih mudah dipahami dan dipelihara.

---

# 11. Strategi Git untuk Migrasi

Sebelum migrasi:

```bash
main
 │
 ├── selesaikan checklist fitur
 │
 ├── test
 │
 ├── commit
 │
 └── push
 │
 ↓
baseline stabil
```

Kemudian:

```bash
main
 │
 └── buat branch baru
          │
          └── architecture-local-first
                    │
                    ├── refactor data layer
                    ├── refactor stores
                    ├── implement sync queue
                    ├── implement manual sync
                    ├── implement automatic sync
                    ├── testing
                    └── fixing
```

Jika sudah stabil:

```bash
architecture-local-first
          ↓
       merge
          ↓
        main
```

Setelah merge, branch utama menjadi versi baru yang menggunakan arsitektur local-first.

Branch migrasi juga berfungsi sebagai safety net selama proses pengembangan.

---

# 12. Target Akhir

Arsitektur yang diinginkan:

```bash
                 ┌───────────────┐
                 │     User      │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │   Components  │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Alpine Stores │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │   IndexedDB   │
                 │               │
                 │ accounts      │
                 │ categories    │
                 │ transactions  │
                 │ sync_queue    │
                 └───────┬───────┘
                         │
                  Sync Trigger
                    ↙         ↘
             Automatic       Manual
                    ↘         ↙
                         ↓
                 ┌───────────────┐
                 │ sync.service  │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │   Supabase    │
                 └───────────────┘
```

Tujuan utamanya:

**Aplikasi tetap cepat karena operasi normal terjadi di lokal, sementara Supabase digunakan sebagai tempat sinkronisasi/persistensi server, bukan sebagai dependency setiap kali user melakukan perubahan.**
