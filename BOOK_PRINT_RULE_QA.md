# Book Print Rule QA

Dokumen ini dipakai untuk uji manual fitur `Book Print Rule & Blank Page Calculator`
di POS `c:\laragon\www\POS-SIDOMULYO` yang terhubung ke ERP
`c:\laragon\www\ERPSIDOMULYO`.

## Lokasi Kode
- POS form dan flow cart: [src/screens/SalesScreen.js](src/screens/SalesScreen.js)
- POS component input Book: [src/components/ProductForm.js](src/components/ProductForm.js)
- POS helper Book: [src/utils/bookPrintRule.js](src/utils/bookPrintRule.js)
- ERP rule engine: `app/Services/Book/BookPrintRuleService.php`
- ERP order snapshot: `app/Services/Pos/OrderPlacementService.php`

## Smoke Test
1. Login ke POS dan buka menu `Input Order`.
2. Pilih customer.
3. Pilih produk yang dikenali sebagai `Book`.
4. Pastikan muncul panel:
   - `Jenis Produk Buku`
   - `Arah Produk Buku`
   - `Segmen`
   - `Catatan kasir`
   - `Ukuran Jadi`
   - `Model Cetak`
   - `Sisi Cetak`
   - `Hal. Customer`
   - `Validasi Halaman`
5. Isi skenario di bawah dan cek hasil preview.

## Skenario Wajib

### 1. A5 Susun Buku Bolak-Balik 12 Halaman
- Input:
  - `Ukuran Jadi = A5`
  - `Model Cetak = Cetak Susun Buku / Lipat Buku`
  - `Sisi Cetak = Cetak Bolak-Balik`
  - `Hal. Customer = 12`
- Expected:
  - `Kelipatan wajib = 8`
  - `Halaman produksi = 16`
  - `Halaman kosong = 4`
  - `Estimasi A3+ = 2 lembar`
  - Muncul pesan bahwa sistem menambah 4 halaman kosong.

### 2. A5 Susun Buku Bolak-Balik 24 Halaman
- Input:
  - `A5`, `Cetak Susun Buku / Lipat Buku`, `Cetak Bolak-Balik`, `24`
- Expected:
  - `Kelipatan wajib = 8`
  - `Halaman produksi = 24`
  - `Halaman kosong = 0`
  - `Estimasi A3+ = 3 lembar`
  - Muncul pesan bahwa jumlah halaman sudah sesuai kelipatan produksi.

### 3. A5 Susun Buku Bolak-Balik 26 Halaman
- Expected:
  - `Kelipatan wajib = 8`
  - `Halaman produksi = 32`
  - `Halaman kosong = 6`
  - `Estimasi A3+ = 4 lembar`

### 4. A4 Normal Bolak-Balik 15 Halaman
- Input:
  - `A4`, `Cetak Normal / Per Halaman`, `Cetak Bolak-Balik`, `15`
- Expected:
  - `Kelipatan wajib = 4`
  - `Halaman produksi = 16`
  - `Halaman kosong = 1`
  - `Estimasi A3+ = 4 lembar`

### 5. A6 Susun Buku Bolak-Balik 18 Halaman
- Input:
  - `A6`, `Cetak Susun Buku / Lipat Buku`, `Cetak Bolak-Balik`, `18`
- Expected:
  - `Kelipatan wajib = 16`
  - `Halaman produksi = 32`
  - `Halaman kosong = 14`
  - `Estimasi A3+ = 2 lembar`

### 6. Custom Size
- Input:
  - `Ukuran Jadi = Custom`
- Expected:
  - Tidak ada hitung final otomatis
  - Muncul pesan cek layout manual
  - Status logic mengarah ke `needs_manual_layout_check`

### 7. Susun Buku 1 Sisi
- Input:
  - `Model Cetak = Cetak Susun Buku / Lipat Buku`
  - `Sisi Cetak = Cetak 1 Sisi`
- Expected:
  - Muncul warning `tidak disarankan`

### 8. Arah Produk Buku Yasin
- Input:
  - `Jenis Buku = Buku Yasin / Tahlil / Doa`
- Expected:
  - `Segmen = Buku Keagamaan & Acara Keluarga`
  - `Ukuran Jadi` otomatis tersisa `A5`
  - `Model Cetak` otomatis tersisa `Cetak Susun Buku / Lipat Buku`
  - `Sisi Cetak` otomatis tersisa `Cetak Bolak-Balik`
  - `Catatan kasir` menjelaskan penambahan halaman kosong jika belum kelipatan 8

### 9. Arah Produk Company Profile
- Input:
  - `Jenis Buku = Company Profile`
- Expected:
  - `Segmen = Bisnis, Perusahaan & Brand`
  - `Ukuran Jadi` menawarkan `A4` dan `A5`
  - `Model Cetak` tersisa `Cetak Normal / Per Halaman`
  - `Sisi Cetak` tersisa `Cetak Bolak-Balik`
  - `Catatan kasir` menjelaskan normal per halaman cocok untuk jilid lem/ring

### 10. Validasi Halaman Lokal
- Input:
  - `Jenis Buku = Buku Yasin / Tahlil / Doa`
  - `Ukuran Jadi = A5`
  - `Sisi Cetak = Cetak Bolak-Balik`
  - `Hal. Customer = 22`
- Expected:
  - Panel `Validasi Halaman` menampilkan:
    - `Halaman input = 22`
    - `Kelipatan wajib = 8`
    - `Halaman kosong tambahan = 2`
    - `Total halaman cetak = 24`
  - Tidak ada hard error

## Uji Cart dan Draft
1. Setelah preview benar, klik `Tambah ke Keranjang`.
2. Pastikan ringkasan item Book di keranjang menampilkan:
   - `size` berbasis `finished_size | print_model`
   - `material` berbasis ringkasan Book seperti `Kelipatan 8 | Produksi 16 hlm | Kosong 4 hlm | A3+ 2 lbr`
3. Simpan sebagai draft.
4. Buka menu `Invoice`, lalu `Lanjut Draft`.
5. Pastikan item Book tetap terbaca dengan ringkasan yang sama dan tidak kehilangan data halaman.

## Uji Process Order
1. Dari keranjang Book, klik `Proses Order`.
2. Pastikan order sukses dibuat.
3. Ambil `order id` dari hasil submit atau daftar invoice.
4. Cek detail order dari backend dan pastikan `spec_snapshot` menyimpan:
   - `type = book`
   - `book_print_rule`
   - `book_specs.finished_size`
   - `book_specs.print_model`
   - `book_specs.print_side`
   - `book_specs.customer_page_count`
   - `book_specs.production_page_count`
   - `book_specs.blank_page_count`
   - `book_specs.estimated_a3_plus_sheets`

## Contoh Payload Preview ke ERP
Endpoint:
- `POST /api/pos/products/{productId}/price`

Contoh body:

```json
{
  "qty": 1,
  "width_mm": null,
  "height_mm": null,
  "material_product_id": null,
  "extra_margin_cm": 0,
  "customer_id": 123,
  "express": false,
  "finishings": [],
  "lb_max": [],
  "finished_size": "A5",
  "print_model": "Cetak Susun Buku / Lipat Buku",
  "print_side": "Cetak Bolak-Balik",
  "customer_page_count": 12,
  "page_count": 12,
  "product_name": "Buku Yasin",
  "product_type": "book",
  "print_mode": "duplex"
}
```

Expected response minimal:

```json
{
  "book_print_rule": {
    "required_page_multiple": 8,
    "production_page_count": 16,
    "blank_page_count": 4,
    "estimated_a3_plus_sheets": 2
  }
}
```

## Contoh Snapshot Item Order
Saat order berhasil disimpan, item Book minimal harus punya struktur seperti ini:

```json
{
  "finished_size": "A5",
  "print_model": "Cetak Susun Buku / Lipat Buku",
  "print_side": "Cetak Bolak-Balik",
  "customer_page_count": 12,
  "production_page_count": 16,
  "blank_page_count": 4,
  "estimated_a3_plus_sheets": 2,
  "spec_snapshot": {
    "type": "book",
    "book_print_rule": {
      "required_page_multiple": 8,
      "production_page_count": 16,
      "blank_page_count": 4
    },
    "book_specs": {
      "finished_size": "A5",
      "print_model": "Cetak Susun Buku / Lipat Buku",
      "print_side": "Cetak Bolak-Balik",
      "customer_page_count": 12,
      "production_page_count": 16,
      "blank_page_count": 4
    }
  }
}
```

## Command Test
POS:

```bash
node --test src/utils/__tests__/bookPrintRule.test.cjs
```

ERP:

```bash
php artisan test tests/Unit/Book/BookPrintRuleServiceTest.php tests/Feature/Pos/BookPrintRulePosIntegrationTest.php
```

## Catatan
- Jika pricing final produk Book di POS nanti harus benar-benar memakai `production_page_count`,
  konfirmasi ulang formula harga aktif di ERP sebelum mengubah kalkulasi subtotal/grand total.
- Flow addon Book lama di ERP belum dipakai POS. Snapshot Book dari POS sekarang diterima walau tanpa addon,
  selama frontend memang tidak mengirim rows addon sama sekali.
