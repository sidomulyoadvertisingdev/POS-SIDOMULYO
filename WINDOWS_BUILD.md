# Build aplikasi Windows

Project ini sudah disiapkan supaya frontend Expo bisa dibungkus menjadi aplikasi Windows installer (`.exe`) memakai Electron.

## 1. Install dependency desktop

```powershell
npm install
```

## 2. Jalankan sebagai aplikasi desktop lokal

```powershell
npm run desktop
```

Perintah ini akan:

1. export frontend web ke folder `dist-web`
2. membuka hasilnya lewat window desktop Electron

## 3. Build installer Windows

```powershell
npm run build:win
```

Hasil installer akan muncul di folder `release`.

## 4. Ganti icon aplikasi dengan logo Anda

File icon aplikasi saat ini dibaca dari:

```text
assets/icon.png
```

Supaya icon tampil rapi di installer, shortcut desktop, dan taskbar Windows:

1. siapkan logo Anda dalam PNG persegi resolusi besar
2. replace file `assets/icon.png`
3. jalankan ulang `npm run build:win`

Saran ukuran icon:

1. minimal 256x256
2. lebih aman 512x512 atau 1024x1024
3. background transparan bila memungkinkan

Kalau nanti Anda sudah punya file `.ico` sendiri, konfigurasinya juga bisa saya arahkan langsung ke file itu.

## 5. Catatan env backend

Nilai `EXPO_PUBLIC_*` akan ikut dibake saat `build:web`, jadi sebelum build installer pastikan `.env` sudah berisi endpoint produksi yang benar.
