# Laporan Audit Proyek POS-SIDOMULYO dan ERPSIDOMULYO

Tanggal audit: 2026-05-21  
Lokasi frontend POS: `c:\laragon\www\POS-SIDOMULYO`  
Lokasi backend ERP: `c:\laragon\www\ERPSIDOMULYO`  
Basis audit: struktur kode lokal, git history, route/API, test otomatis, dan TODO/gap yang terlihat di kode.

## Ringkasan Eksekutif

Frontend `POS-SIDOMULYO` adalah aplikasi POS kasir berbasis Expo/React Native Web + Electron untuk desktop Windows. Repo frontend mulai pada 2026-04-26 dan per 2026-05-20 sudah mencapai versi `1.6.18`. Fokus besarnya adalah input order, invoice workspace, approval/piutang, produksi, pembelian bahan, pengeluaran, close order, receipt printing, dan distribusi Windows lewat Velopack/GitHub Pages.

Backend `ERPSIDOMULYO` adalah Laravel 12 ERP/backoffice yang mulai lebih dulu pada 2026-02-22. Backend sudah memiliki modul besar: POS API, produk/pricing, akuntansi, gudang/warehouse, produksi, customer deposit, piutang/approval, project management, marketplace, dashboard, laporan, dan sinkronisasi data. POS frontend sangat bergantung pada API backend ini, terutama namespace `/api/pos/*`.

Status umum: fitur inti POS dan backend ERP sudah berjalan dan punya cakupan test yang lumayan kuat untuk Book, pricing POS, expense journal, customer deposit, receivable approval, dan sync. Area yang masih perlu dirapikan adalah hardening security remember-password frontend, raw LAN printer bridge, release/update end-to-end, test warehouse purchase yang gagal karena data unik, dan test A3+ export CSV yang tidak cocok dengan format export saat ini.

## Timeline Proyek

### Backend ERPSIDOMULYO

- 2026-02-22: initial commit `Initial commit ERPSIDOMULYO`.
- 2026-02-24 sampai 2026-03-07: fondasi dashboard, penjualan manual, kas masuk/keluar, invoice pickup, user POS, akuntansi, dan API ERP.
- 2026-03-26 sampai 2026-04-02: akuntansi/warehouse, pembayaran gaji, stok tinta, profile, notifikasi, monitoring timbangan, landing page, SEO.
- 2026-04-12 sampai 2026-04-25: marketplace, project management, fitur buku, kategori produk, finishing manual, draft/autosave, variant, addon mata ayam, permission, customer/LB max, backup/restore produk, stock reminder.
- 2026-04-29 sampai 2026-05-05: sticker, MMT pricing, release 1.5.9/1.6.0, draft invoice isolation.
- 2026-05-06 sampai 2026-05-14: draft snapshots, POS reports/product grouping, customer deposit sync, payment fixes, A3+ material flow, reseller-retail reports, customer duplicate cleanup.
- 2026-05-17 sampai 2026-05-20: invoice workflow approval, backend pricing/book setup, approval queue compatibility, sync optimization, customer balance payment, POS purchase/expense accounting workflow, repair double-post expense history.

Statistik backend saat audit:

- Commit: 158.
- Migrasi database: 189 file.
- Test PHP: 63 file.
- Blade view backend/admin: 258 file.
- Controller/service/model utama: 306 file.
- API POS controller: 16 file.

### Frontend POS-SIDOMULYO

- 2026-04-26: initial commit frontend POS.
- 2026-04-27 sampai 2026-05-02: versi 1.0.0 dan perbaikan bug perhitungan penjualan.
- 2026-05-05: lonjakan besar release/build, Velopack auto update, GitHub Pages, thermal default, A3+ picker, API fallback, dan release 1.6.0.
- 2026-05-06 sampai 2026-05-12: online sync, safe draft restore, receipt flow, master data auto sync, customer deposit, qty-only bundle, payment flow, SPK thermal, closing report payment mapping, loader dotlottie.
- 2026-05-15: book rule, POS customer updates, product picker fix.
- 2026-05-18: invoice workflow dan approval workspace.
- 2026-05-19: POS balance payments dan online API default.
- 2026-05-20: release `v1.6.18` dengan backend-driven purchase dan expense flows.

Statistik frontend saat audit:

- Commit: 53.
- Versi package: `1.6.18`.
- Source JS/TS utama: 77 file di `src/components`, `src/screens`, `src/services`, `src/utils`, dan `src/printing`.
- Total source frontend termasuk config/data/mockups: 79 file.
- Runtime: Expo `~54.0.34`, React `19.1.0`, React Native `0.81.5`, Electron `37.2.0`, Velopack.

## Frontend yang Sudah Dibuat

1. POS kasir desktop/web

- File utama: `App.js`, `src/screens/LoginScreen.js`, `src/screens/SalesScreen.js`.
- Sudah ada login backend, startup splash, font fallback, error boundary, logout, dan routing login ke sales workspace.
- Sales workspace sudah menjadi pusat menu: `Input Order`, `Invoice`, `Produksi`, `Pembelian Bahan`, `Pengeluaran`, `Laporan`, dan `Pengaturan`.

2. Input order dan product form

- File utama: `src/components/ProductForm.js`, folder `src/components/product-form/`.
- Sudah mendukung mode produk: Book, MMT/measured, Sticker, Fixed Size, Custom Size, Qty Only, finishing, material summary, product picker tree, dan LB Max.
- Ada helper `src/utils/productPickerTree.js`, `src/utils/productModes.js`, `src/utils/orderPayload.js`, dan `src/utils/currency.js`.

3. Book print rule dan blank page calculator

- File utama: `src/utils/bookPrintRule.js`, `src/components/product-form/BookRulePanel.js`, `BOOK_PRINT_RULE_QA.md`.
- Sudah menghitung kelipatan halaman, halaman produksi, blank page, estimasi A3+, rule custom layout, lock print side, dan filter opsi berdasarkan konteks backend.
- Test frontend Book lewat: 23 test.

4. Invoice workspace, approval, piutang, dan pickup

- File utama: `src/components/InvoiceWorkspaceContent.js`, `InvoiceWorkspaceHeader.js`, `InvoiceWorkspaceRowCard.js`, `src/utils/invoiceVisibility.js`.
- Sudah ada filter invoice sukses/draft/piutang/approval, detail invoice, reprint, manual approval, receivable approval, pickup, dan proteksi akses invoice berdasarkan user.

5. Pembayaran dan saldo pelanggan

- File utama: `src/components/PaymentSummary.js`, `src/components/TransactionHeader.js`, `src/services/erpApi.js`.
- Sudah mendukung cash/noncash/customer deposit, pemilihan akun pembayaran backend, top-up deposit, validasi payment method, dan fallback pesan ketika mapping akun belum siap.

6. Produksi

- File utama: `src/components/ProductionPanel.js`, `src/screens/SalesScreen.js`.
- Sudah ada list produksi, filter status, counter status, pencarian, update status `waiting_production -> in_batch -> printed`, dan notifikasi suara.

7. Pembelian bahan dan pengeluaran

- File utama: `src/components/PurchaseMaterialPanel.js`, `src/components/ExpensePanel.js`.
- Sudah terhubung ke backend untuk kategori pembelian/pengeluaran, request bahan gudang, belanja toko/manual, detail/list, filter tanggal, source account, kategori item popup, dan submit cash flow.
- Masih ada catatan backend-detail yang perlu dirapikan, dijelaskan di bagian gap.

8. Close order dan laporan

- File utama: `src/screens/SalesScreen.js`.
- Sudah ada closing summary, laporan kas masuk/keluar, top product, close order record, submit close order ke finance, cetak/copy laporan.

9. Printing module

- File utama: `src/printing/*`.
- Sudah ada render receipt text/html, PDF download, browser print session, ESC/POS builder, profiles 58/80/custom, QZ/local service adapter, settings form, dan test render TypeScript.
- `TcpEscPosPrintAdapter` masih stub karena browser tidak bisa membuka socket TCP langsung.

10. Electron, Windows build, dan auto update

- File utama: `electron/main.js`, `electron/update-config.js`, `scripts/build-velopack.js`, `scripts/prepare-pages-site.js`, `.github/workflows/publish-velopack-pages.yml`, `WINDOWS_BUILD.md`.
- Sudah ada build web, desktop Electron, build Windows, build GitHub Pages, dan Velopack update feed.

## Backend yang Sudah Dikerjakan

1. Auth dan API dasar

- Route `routes/api.php` menyediakan `auth/register`, `auth/login`, `auth/me`, `auth/logout`, dan `auth/refresh`.
- Backend memakai JWT auth (`php-open-source-saver/jwt-auth`) dan permission (`spatie/laravel-permission`).

2. POS API utama

- Prefix `/api/pos` sudah mencakup settings, finishings, products, product price preview, materials, low stock, stock request, purchase categories, purchases, customer types, customers, receivable summary, deposit top-up, orders, invoices, payment accounts, design, reports, cash flows, dan integrations.
- Controller utama: `app/Http/Controllers/Api/Pos/*`.
- Service utama: `app/Services/Pos/*`, `app/Services/Book/*`, `app/Services/Sync/*`.

3. Produk, pricing, Book, Sticker, MMT, A3+

- Backend punya `BookPrintRuleService`, `BookProductConfigService`, `Pos\PricingService`, `OrderPlacementService`, import/export produk, stampel import preview, A3+ material usage, sticker billing rules, finishing bundle, dan mode legacy compatibility.
- Test terkait Book dan product import sebagian besar sudah kuat.

4. Order, invoice, approval, dan piutang

- `OrderController` mencakup order list/detail/store/destroy/status, receivable approval, manual approval, online order approval/rejection, marketplace payment, pickup, production items, design upload, batch production, dan finalize production batch.
- Ada test untuk receivable approval, manual approval workflow, deposit reversal, cashier invoice visibility, draft isolation, draft restore, dan production approval lock.

5. Customer deposit dan finance

- API finance tersedia untuk customer fund receipt, allocation, customer deposit, deposit mutations, refund request, approve/reject/process refund.
- Test customer deposit POS lewat dalam audit.

6. Akuntansi dan expense journal

- Ada modul `Akuntansi`, jurnal, akun, laporan, bank mutations, customer deposit accounting, POS closer order accounting, sales accounting, dan expense journal.
- `ExpenseJournalService` membuat income/expense transaction dan jurnal seimbang untuk cash/bank/e-wallet/unpaid.
- Test expense journal lewat 7 test dalam audit.

7. Purchase/pengeluaran POS dan warehouse

- Migrasi 2026-05-19 sampai 2026-05-20 menambahkan `pos_purchase_requests`, `source_reference`, kategori pembelian/pengeluaran, item kategori, payment columns, journal references, dan repair double-post.
- `PurchaseRequestController` sudah menangani list/show/store/update POS purchase, link ke expense transaction, journal source reference, category/item snapshot, dan mapping akun.
- `CashFlowController` sudah mendukung index/show/store/types dan resolve reference ke `pos_purchase_request`.

8. Sync data

- API `sync/status` dan `sync/changes` tersedia di root API dan prefix POS.
- Service `SyncStatusService` dan `SyncChangesService` sudah dipakai POS untuk master data sync/cache.
- Test sync status/changes lewat dalam audit.

9. Backoffice admin Blade/Vite

- Backend punya web admin besar berbasis Blade: dashboard role, produk, sales, warehouse, purchase categories, production, production machine, accounting, reports, customers/suppliers, marketplace, project manager, settings, backup/restore, notification, users/access control.
- Ada 258 Blade view.

10. Project management internal

- API project management sudah punya project, list, task, move/reorder, comments, labels, dan user directory.
- Web view `resources/views/backend/project-manager/*` tersedia.
- Catatan: label custom API masih mengembalikan pesan bahwa label custom belum disimpan ke database dan sementara memakai JSON task.

## Hasil Verifikasi Test

Frontend POS:

- `npm.cmd run test:book-print-rule`: lewat, 23 test.
- `npm.cmd run test:product-picker`: lewat, 3 test.
- `npm.cmd run test:receipt-summary`: lewat, 5 test.
- `npm.cmd run test:receipt-render`: lewat, TypeScript noEmit untuk modul printing.

Backend ERP POS/Book/expense/sync:

- Command:
  `php artisan test tests/Unit/Book/BookPrintRuleServiceTest.php tests/Feature/Pos/BookPrintRulePosIntegrationTest.php tests/Feature/Pos/ExpenseJournalGenerationTest.php tests/Feature/Pos/ManualApprovalWorkflowTest.php tests/Feature/Pos/CustomerReceivableApprovalApiTest.php tests/Feature/Pos/CustomerDepositTest.php tests/Feature/Api/SyncStatusTest.php tests/Feature/Api/SyncChangesTest.php`
- Hasil: lewat, 52 test, 329 assertions.

Backend product/warehouse tambahan:

- Command:
  `php artisan test tests/Feature/WarehousePurchasePaymentTest.php tests/Feature/Products/BookImportTemplateTest.php tests/Feature/Products/StampelImportPreviewTest.php tests/Feature/Products/A3PlusImportTemplateTest.php tests/Feature/Products/A3PlusImportMaterialUsageTest.php`
- Hasil: 22 test lewat, 3 gagal.
- Gagal 1 dan 2: `WarehousePurchasePaymentTest` duplicate `warehouses.code` untuk `GDG-UTAMA`.
- Gagal 3: `A3PlusImportTemplateTest` mengharapkan substring CSV `MAT-A3P-HVS-80,32,lembar`, tetapi format export saat ini memisahkan kolom sehingga string itu tidak muncul berurutan.

## Yang Belum / Perlu Diperbaiki

1. Security remember password frontend

- `src/screens/LoginScreen.js` menyimpan email dan password remember-login ke `localStorage`.
- Risiko: password polos tersimpan di runtime desktop/web.
- Rekomendasi: ubah remember login menjadi simpan email saja, atau gunakan secure credential storage di Electron/desktop.

2. Raw TCP/LAN printing

- `src/printing/adapters/TcpEscPosPrintAdapter.ts` masih stub.
- Risiko: printer LAN raw ESC/POS belum bisa dipakai langsung dari POS.
- Rekomendasi: buat bridge Electron main process atau local print service untuk TCP 9100/USB; browser fallback tetap dipertahankan.

3. Release GitHub Pages dan Velopack end-to-end

- Workflow dan script sudah ada, tetapi perlu bukti run produksi: Pages aktif, `releases.win.json` publik, aplikasi installed mendeteksi update.
- Rekomendasi: buat checklist release final per versi dan simpan hasil run workflow/URL feed.

4. Detail pembelian bahan dan pengeluaran perlu diselesaikan end-to-end

- Frontend masih punya TODO:
  - `PurchaseMaterialPanel.js`: detail nominal pembelian untuk semua kategori masih mengandalkan metadata lokal.
  - `ExpensePanel.js`: detail pengeluaran dan referensi pembelian/request gudang pernah ditandai best-effort.
- Backend terbaru sudah punya `CashFlowController::show`, `source_reference_type/id`, `purchase_category_item_id`, dan `PurchaseRequestController::show`.
- Rekomendasi: uji ulang frontend terhadap backend terbaru; jika response detail sudah lengkap, hapus TODO frontend dan gunakan payload detail resmi. Jika belum, lengkapi endpoint agar selalu mengirim item, category snapshot, linked expense transaction, journal, payment account, dan source reference.

5. Warehouse purchase test gagal karena duplicate warehouse code

- `WarehousePurchasePaymentTest` membuat warehouse `GDG-UTAMA`, sementara database test/seeder kemungkinan sudah punya code yang sama.
- Rekomendasi: ubah test helper memakai `firstOrCreate` atau code unik per test, misalnya `GDG-UTAMA-TEST-<uniqid>`.

6. A3+ export CSV test tidak cocok dengan format export saat ini

- Test mencari substring `MAT-A3P-HVS-80,32,lembar`.
- CSV saat ini punya `material_skus` lalu banyak kolom lain sebelum `material_usage_qty` dan `material_unit`, sehingga substring tersebut tidak berurutan.
- Rekomendasi: perbaiki assertion test dengan parsing CSV dan cek kolom `material_skus`, `material_usage_qty`, `material_unit`, bukan substring raw.

7. Label custom project management belum persisted

- `LabelController` mengembalikan pesan bahwa label custom belum disimpan ke database dan sementara memakai labels JSON pada task.
- Rekomendasi: buat tabel label project atau pakai model label permanen agar board internal tidak bergantung pada JSON task.

8. Banyak layer legacy/fallback masih aktif

- Backend masih punya banyak adapter legacy untuk Book, MMT, material usage, kategori lama, permission lama, dan repair historical data.
- Ini bagus untuk kompatibilitas, tetapi perlu rencana deprecation.
- Rekomendasi: buat daftar field legacy yang masih dibaca, kapan dimigrasikan, dan command audit sebelum field lama dilepas.

9. Dirty working tree perlu ditutup sebelum rilis

- Frontend ada perubahan lokal di `.env`, `.env.example`, `app.config.js`, `src/config/appEnv.js`, `src/screens/SalesScreen.js`, `src/services/erpApi.js`, dan Book rule test/helper.
- Backend ada perubahan lokal besar di order/product/pricing/config/dashboard/routes/tests, plus file baru `DashboardRevenueController`, `BookCategoryService`, `BookProductConfigService`, `DashboardRevenueService`, dan `ConfigServiceTest`.
- Rekomendasi: review, test, commit terpisah per tema sebelum release berikutnya.

## Prioritas Rekomendasi

Prioritas tinggi:

- Selesaikan secure remember-login.
- Selesaikan raw printer bridge untuk LAN/USB jika printer toko memakai ESC/POS langsung.
- Pastikan detail purchase/expense frontend memakai endpoint backend resmi, bukan metadata lokal.
- Rapikan test yang gagal agar pipeline tidak merah saat full regression.

Prioritas menengah:

- Jalankan release Velopack end-to-end dan dokumentasikan URL feed aktif.
- Buat test frontend tambahan untuk `customerPhone`, `invoiceVisibility`, dan `productModes` masuk script npm agar tidak terlewat.
- Tambahkan test POS API untuk `PurchaseRequestController::show` dan `CashFlowController::show` dengan source reference ke `pos_purchase_request`.

Prioritas rendah tapi penting untuk maintenance:

- Kurangi fallback/legacy setelah data lama selesai dimigrasikan.
- Persist project label custom di backend.
- Pecah `SalesScreen.js` yang sangat besar menjadi workspace hooks/components agar risiko regression lebih kecil.

## Kesimpulan

Proyek sudah berada di fase integrasi matang, bukan fase awal. Backend dimulai 2026-02-22 sebagai ERP besar, lalu frontend POS dimulai 2026-04-26 dan mengejar integrasi ke backend sampai versi 1.6.18 pada 2026-05-20. Alur utama kasir sudah tersedia: login, input order, pricing, draft, invoice, approval/piutang, customer deposit, produksi, pembelian bahan, pengeluaran, close order, receipt, dan release desktop.

Yang paling perlu dijaga sekarang adalah kualitas integrasi dan hardening produksi: security credential, printer bridge, test regression yang stabil, dan penyelesaian detail purchase/expense agar tidak ada lagi catatan best-effort di frontend.
