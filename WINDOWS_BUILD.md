# Build aplikasi Windows + auto update Velopack

Project ini sekarang memakai `Electron + Velopack` supaya aplikasi Windows yang sudah terinstall bisa mengecek versi terbaru, mengunduh update otomatis, lalu meminta restart saat update siap dipasang.

## 1. Install dependency

```powershell
npm install
```

## 2. Install .NET SDK

Velopack CLI dijalankan lewat `dnx`, jadi mesin build wajib punya `.NET SDK`.

```powershell
winget install Microsoft.DotNet.SDK.8
```

Sesudah itu tutup dan buka terminal baru, lalu cek:

```powershell
dnx --version
```

## 3. Atur URL feed update Velopack

Edit file [electron/update-config.js](/c:/laragon/www/pos-kasir-expo/electron/update-config.js) lalu ganti:

```js
https://pos.sidomulyoproject.com
```

dengan URL publish release updater Anda. URL default project sekarang sudah diarahkan ke:

```text
https://pos.sidomulyoproject.com
```

Catatan:

1. Folder URL itu nanti harus berisi file seperti `releases.win.json`, paket `.nupkg`, dan installer `.exe`.
2. Kalau URL placeholder belum diganti, auto update akan otomatis nonaktif.
3. Project ini sekarang default ke self-hosted release server di `pos.sidomulyoproject.com`.

## 4. Jalankan aplikasi desktop lokal

```powershell
npm run desktop
```

Perintah ini akan:

1. export frontend web ke folder `dist-web`
2. membuka hasilnya lewat window desktop Electron

## 5. Build release Windows dengan Velopack

```powershell
npm run build:win
```

Perintah ini akan:

1. build web Expo
2. generate folder aplikasi Windows `win-unpacked`
3. membungkus hasilnya menjadi release Velopack

Output utama akan ada di:

```text
release/velopack
```

Biasanya isi pentingnya:

1. `POS Kasir-Setup-<version>.exe`
2. `releases.win.json`
3. file paket `.nupkg`

Catatan versi:

1. Versi release Velopack mengikuti `package.json`.
2. Label versi di UI sekarang otomatis ikut `package.json` jika `EXPO_PUBLIC_APP_VERSION` dikosongkan.
3. Jadi sebelum rilis, cukup naikkan versi di `package.json`.

## 6. Build site self-hosted

Kalau Anda ingin menyiapkan hasil yang siap dipublish ke server sendiri pada root domain `pos.sidomulyoproject.com`, gunakan:

```powershell
npm run build:selfhost
```

Perintah ini akan:

1. build web Expo ke `dist-web`
2. build release Windows ke `release/velopack`
3. menggabungkan web app + file Velopack ke `release/selfhost-site`
4. menyesuaikan asset web ke root domain `/`

Output publish self-hosted akan ada di:

```text
release/selfhost-site
```

Isi pentingnya biasanya:

1. `index.html`
2. `releases.win.json`
3. paket `.nupkg`
4. installer `.exe`

## 7. Upload ke server sendiri

Upload seluruh isi folder `release/selfhost-site` ke document root web `pos.sidomulyoproject.com`.

File penting yang wajib bisa diakses publik:

1. `https://pos.sidomulyoproject.com/`
2. `https://pos.sidomulyoproject.com/releases.win.json`
3. `https://pos.sidomulyoproject.com/POS Kasir-Setup-<version>.exe`
4. file `.nupkg` yang dirujuk di `releases.win.json`

## 8. Opsi legacy GitHub Pages

Kalau Anda masih ingin menyiapkan hasil yang siap dipublish ke GitHub Pages, gunakan:

```powershell
npm run build:pages
```

Perintah ini akan tetap menghasilkan output di:

```text
release/pages-site
```

dan otomatis menyesuaikan asset web ke base path repo `POS-SIDOMULYO`.

## 9. Publish file release ke GitHub Pages

Ada 2 cara:

### Opsi A. Manual

Upload seluruh isi folder `release/pages-site` ke source GitHub Pages pada repo `sidomulyoadvertisingdev/POS-SIDOMULYO`.

### Opsi B. Otomatis via GitHub Actions

Project ini sudah disiapkan workflow [publish-velopack-pages.yml](/c:/laragon/www/pos-kasir-expo/.github/workflows/publish-velopack-pages.yml).

Langkahnya:

1. push project ini ke GitHub
2. buka `Settings > Pages`
3. set source ke `GitHub Actions`
4. jalankan workflow `Publish Velopack Pages`

Atau push tag versi, misalnya:

```powershell
git tag v1.6.1
git push origin v1.6.1
```

Workflow itu akan:

1. menjalankan `npm ci`
2. build site GitHub Pages lewat `npm run build:pages`
3. mengambil isi `release/pages-site`
4. publish hasilnya ke GitHub Pages

URL hasil publish yang akan dipakai updater:

```text
https://sidomulyoadvertisingdev.github.io/POS-SIDOMULYO/releases.win.json
```

File itu harus bisa diakses langsung dari komputer client.

## 10. Checklist rilis singkat

Sebelum push:

1. pastikan `.env` sudah mengarah ke backend produksi
2. naikkan `version` di `package.json`
3. jalankan `npm ci`
4. jalankan `npm run build:selfhost`
5. cek folder `release/selfhost-site` terisi `index.html` dan `releases.win.json`

Sesudah push:

1. upload isi `release/selfhost-site` ke server
2. buka `https://pos.sidomulyoproject.com/`
3. cek `https://pos.sidomulyoproject.com/releases.win.json`
4. pastikan file installer dan `.nupkg` bisa diakses publik

Kalau gagal di `npm ci`:

1. jalankan `npm install`
2. commit perubahan `package-lock.json`
3. push ulang

Kalau web tampil `404`:

1. cek document root domain `pos.sidomulyoproject.com`
2. pastikan file `index.html` sudah ter-upload
3. pastikan asset `_expo` dan `assets` ikut ter-upload

## 11. Catatan migrasi dari GitHub Pages ke server sendiri

Kalau aplikasi client lama sebelumnya mengecek update ke GitHub Pages, client itu belum otomatis tahu URL baru. Supaya migrasi aman, lakukan salah satu:

1. publish satu release transisi ke feed lama GitHub Pages yang berisi build baru dengan `update-config.js` sudah menunjuk ke `https://pos.sidomulyoproject.com`
2. atau mirror file release terbaru yang sama ke GitHub Pages dan server baru selama masa transisi

Sesudah client sudah naik ke build yang memakai URL baru, update berikutnya cukup di `pos.sidomulyoproject.com`.

## 12. Cara kerja update otomatis di client

Setelah aplikasi versi baru dirilis dan file release baru diupload:

1. aplikasi terinstall akan cek update otomatis saat startup
2. jika ada versi baru, paket update akan diunduh di background
3. setelah selesai, user akan melihat prompt restart
4. kalau user pilih `Nanti`, update tetap akan terpasang saat aplikasi dibuka ulang berikutnya

## 13. Build installer lama tanpa Velopack

Kalau Anda masih butuh installer NSIS lama:

```powershell
npm run build:win:legacy
```

## 14. Supaya installer tidak mudah dicurigai Windows

Hal yang paling menentukan tetap `code signing certificate`.

1. Gunakan `productName`, `appId`, dan icon yang konsisten.
2. Naikkan versi aplikasi secara rapi di `package.json`.
3. Sign file installer dan executable hasil release.
4. Distribusikan file yang sudah signed.

Tanpa code signing, Windows tetap bisa menampilkan `Unknown Publisher` walaupun metadata aplikasi sudah rapi.

## 15. Catatan backend

Nilai `EXPO_PUBLIC_*` ikut dibake saat `build:web`, jadi sebelum build release pastikan `.env` sudah mengarah ke endpoint produksi yang benar.
