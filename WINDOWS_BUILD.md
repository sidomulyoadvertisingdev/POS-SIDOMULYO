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

## 3. Atur URL feed update GitHub Pages

Edit file [electron/update-config.js](/c:/laragon/www/pos-kasir-expo/electron/update-config.js) lalu ganti:

```js
https://sidomulyoadvertisingdev.github.io/POS-SIDOMULYO
```

dengan URL GitHub Pages repo ini. URL default project sekarang sudah diarahkan ke:

```text
https://sidomulyoadvertisingdev.github.io/POS-SIDOMULYO
```

Catatan:

1. Folder URL itu nanti harus berisi file seperti `releases.win.json`, paket `.nupkg`, dan installer `.exe`.
2. Kalau URL placeholder belum diganti, auto update akan otomatis nonaktif.
3. Project ini sekarang disiapkan untuk memakai repo yang sama sebagai source code dan source release GitHub Pages.

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

## 6. Publish file release ke GitHub Pages

Ada 2 cara:

### Opsi A. Manual

Upload seluruh isi folder `release/velopack` ke source GitHub Pages pada repo `sidomulyoadvertisingdev/POS-SIDOMULYO`.

### Opsi B. Otomatis via GitHub Actions

Project ini sudah disiapkan workflow [publish-velopack-pages.yml](/c:/laragon/www/pos-kasir-expo/.github/workflows/publish-velopack-pages.yml).

Langkahnya:

1. push project ini ke GitHub
2. buka `Settings > Pages`
3. set source ke `GitHub Actions`
4. jalankan workflow `Publish Velopack Pages`

Atau push tag versi, misalnya:

```powershell
git tag v1.5.10
git push origin v1.5.10
```

Workflow itu akan:

1. build release Windows
2. mengambil isi `release/velopack`
3. publish hasilnya ke GitHub Pages

URL hasil publish yang akan dipakai updater:

```text
https://sidomulyoadvertisingdev.github.io/POS-SIDOMULYO/releases.win.json
```

File itu harus bisa diakses langsung dari komputer client.

## 7. Cara kerja update otomatis di client

Setelah aplikasi versi baru dirilis dan file release baru diupload:

1. aplikasi terinstall akan cek update otomatis saat startup
2. jika ada versi baru, paket update akan diunduh di background
3. setelah selesai, user akan melihat prompt restart
4. kalau user pilih `Nanti`, update tetap akan terpasang saat aplikasi dibuka ulang berikutnya

## 8. Build installer lama tanpa Velopack

Kalau Anda masih butuh installer NSIS lama:

```powershell
npm run build:win:legacy
```

## 9. Supaya installer tidak mudah dicurigai Windows

Hal yang paling menentukan tetap `code signing certificate`.

1. Gunakan `productName`, `appId`, dan icon yang konsisten.
2. Naikkan versi aplikasi secara rapi di `package.json`.
3. Sign file installer dan executable hasil release.
4. Distribusikan file yang sudah signed.

Tanpa code signing, Windows tetap bisa menampilkan `Unknown Publisher` walaupun metadata aplikasi sudah rapi.

## 10. Catatan backend

Nilai `EXPO_PUBLIC_*` ikut dibake saat `build:web`, jadi sebelum build release pastikan `.env` sudah mengarah ke endpoint produksi yang benar.
