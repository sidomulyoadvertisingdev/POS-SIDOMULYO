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

## Workflow GitHub Actions

Project ini sekarang punya workflow self-hosted berikut:

1. [build-velopack-selfhost.yml](/c:/laragon/www/POS-SIDOMULYO/.github/workflows/build-velopack-selfhost.yml:1)

Fungsinya:

1. restore metadata Velopack terbaru dari `https://pos.sidomulyoproject.com`
2. build `release/selfhost-site`
3. upload artifact hasil build
4. opsional deploy otomatis ke server sendiri lewat SSH + `rsync`

Kalau ingin deploy otomatis dari GitHub Actions, isi secrets repo:

1. `SELFHOST_SSH_HOST`
2. `SELFHOST_SSH_PORT`
3. `SELFHOST_SSH_USER`
4. `SELFHOST_SSH_KEY`
5. `SELFHOST_DEPLOY_PATH`

Kalau secrets itu belum diisi, workflow tetap build dan upload artifact ZIP supaya bisa di-download lalu di-upload manual ke server.

## Catatan migrasi

Client lama masih mengecek feed lama GitHub Pages. Karena itu release `1.6.22` harus dipublish ke 2 tempat:

1. `release/pages-site` ke feed GitHub Pages lama
2. `release/selfhost-site` ke `pos.sidomulyoproject.com`

Sesudah client lama berhasil update ke `1.6.22`, update berikutnya akan memakai domain baru karena URL feed updater di dalam aplikasi sudah berubah.
