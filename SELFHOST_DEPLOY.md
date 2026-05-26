# Self-Hosted Velopack Deploy

Dokumen ini dipakai saat migrasi auto-update dari GitHub Pages ke server sendiri di `https://pos.sidomulyoproject.com`.

## Output yang harus di-upload

Upload seluruh isi folder berikut ke document root domain:

```text
release/selfhost-site
```

Isi penting yang wajib ikut ter-upload:

1. `index.html`
2. `releases.win.json`
3. `RELEASES`
4. `assets.win.json`
5. file `.nupkg`
6. `com.sidomulyo.poskasir-win-Setup.exe`
7. folder `_expo`
8. folder `assets`

## Cek cepat sesudah upload

URL berikut harus bisa dibuka langsung:

1. `https://pos.sidomulyoproject.com/`
2. `https://pos.sidomulyoproject.com/releases.win.json`
3. `https://pos.sidomulyoproject.com/RELEASES`
4. `https://pos.sidomulyoproject.com/com.sidomulyo.poskasir-win-Setup.exe`

Kalau `releases.win.json` menampilkan HTML `index.html`, berarti server masih salah menangani SPA fallback.

## Template server

Project ini sudah menyiapkan 2 contoh:

1. Nginx: [deploy/nginx/pos.sidomulyoproject.com.conf](/c:/laragon/www/POS-SIDOMULYO/deploy/nginx/pos.sidomulyoproject.com.conf:1)
2. Apache: [deploy/apache/.htaccess](/c:/laragon/www/POS-SIDOMULYO/deploy/apache/.htaccess:1)

## Catatan migrasi

Client lama masih mengecek feed lama GitHub Pages. Karena itu release `1.6.22` harus dipublish ke 2 tempat:

1. `release/pages-site` ke feed GitHub Pages lama
2. `release/selfhost-site` ke `pos.sidomulyoproject.com`

Sesudah client lama berhasil update ke `1.6.22`, update berikutnya akan memakai domain baru karena URL feed updater di dalam aplikasi sudah berubah.
