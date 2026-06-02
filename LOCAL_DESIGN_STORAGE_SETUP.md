# Panduan Setting Storage Lokal File Produksi

Dokumen ini dipakai untuk menyiapkan folder jaringan lokal agar file layout/design dari POS bisa disimpan di satu komputer server, lalu dibuka dari komputer lain lewat LAN.

Contoh yang dipakai:

```text
Folder lokal server : E:\file siap layout
Nama share SMB      : file siap layout
Path share LAN      : \\192.168.0.103\file siap layout\
```

Ganti `192.168.0.103` dengan IP komputer server yang sebenarnya.

## 1. Tentukan Komputer Server

Pilih satu komputer yang akan menjadi tempat penyimpanan file layout/design. Komputer ini harus:

1. Selalu menyala saat POS dipakai.
2. Terhubung ke jaringan LAN/Wi-Fi yang sama dengan komputer POS lain.
3. Punya folder khusus, misalnya `E:\file siap layout`.
4. Punya IP yang stabil. Lebih baik set static IP atau DHCP reservation di router.

Cek nama komputer dan IP:

```powershell
hostname
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown'
} | Select-Object InterfaceAlias,IPAddress,PrefixLength
```

## 2. Jalankan PowerShell sebagai Administrator

Semua perintah share wajib dijalankan dari PowerShell yang elevated.

Cara cepat:

1. Klik Start.
2. Cari `PowerShell`.
3. Klik kanan `Windows PowerShell`.
4. Pilih `Run as administrator`.
5. Pastikan prompt terlihat seperti:

```text
PS C:\Windows\system32>
```

Jika tidak Run as Administrator, biasanya muncul error:

```text
New-SmbShare : Access is denied.
The requested operation requires elevation (Run as administrator).
```

## 3. Buat Folder Lokal

Di PowerShell Administrator:

```powershell
New-Item -ItemType Directory -Force -Path "E:\file siap layout"
```

## 4. Pastikan Network Profile Private

Cek profile jaringan:

```powershell
Get-NetConnectionProfile
```

Jika `NetworkCategory` masih `Public`, ubah ke `Private`:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

Catatan:

1. Ganti `"Wi-Fi"` sesuai `InterfaceAlias` dari hasil `Get-NetConnectionProfile`.
2. Jika perintah ini ditolak karena Group Policy, lanjutkan dulu. Yang paling penting share SMB dan firewall bisa dibuat.

## 5. Buat Share SMB

Buat share yang mengarah ke folder lokal:

```powershell
New-SmbShare -Name "file siap layout" -Path "E:\file siap layout" -ChangeAccess "Everyone"
```

Beri izin tulis ke folder. Gunakan SID `Everyone` agar aman di Windows bahasa apa pun:

```powershell
icacls "E:\file siap layout" /grant "*S-1-1-0:(OI)(CI)M"
```

Aktifkan firewall rule file sharing:

```powershell
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes
```

Jika share sudah pernah dibuat, gunakan:

```powershell
Grant-SmbShareAccess -Name "file siap layout" -AccountName "Everyone" -AccessRight Change -Force
icacls "E:\file siap layout" /grant "*S-1-1-0:(OI)(CI)M"
```

## 6. Test di Komputer Server

Cek daftar share:

```powershell
net share
```

Harus ada baris seperti ini:

```text
file siap layout    E:\file siap layout
```

Test UNC path dari komputer server:

```powershell
Test-Path "\\192.168.0.103\file siap layout\"
```

Hasil harus:

```text
True
```

Jika masih `False`, berarti share belum aktif, nama share salah, IP salah, atau firewall masih memblokir.

## 7. Test dari Komputer POS Lain

Di komputer POS lain, buka PowerShell biasa lalu test:

```powershell
Test-Path "\\192.168.0.103\file siap layout\"
```

Jika hasil `True`, test tulis file:

```powershell
"test sidomulyo" | Set-Content "\\192.168.0.103\file siap layout\test-pos.txt"
Remove-Item "\\192.168.0.103\file siap layout\test-pos.txt"
```

Jika test tulis gagal, biasanya permission share atau permission folder belum benar.

## 8. Isi Setting di Aplikasi POS

Di aplikasi POS, masuk ke setting storage lokal file produksi/layout, lalu isi:

```text
Root folder lokal
E:\file siap layout

Path share LAN
\\192.168.0.103\file siap layout\

Folder share
file siap layout

Nama server
Komputer Design

Host server
192.168.0.103
```

Catatan penting:

1. `Root folder lokal` adalah path fisik di komputer server.
2. `Path share LAN` adalah alamat UNC yang bisa dibuka dari komputer lain.
3. Jangan mengetik `Root folder lokal:` atau `Path share LAN:` di PowerShell. Itu adalah label form POS, bukan perintah terminal.

Klik tombol test sambungan di POS. Hasil yang benar:

```text
Sambungan jaringan lokal siap dipakai.
OK - Root folder lokal
OK - Path share LAN
```

## 9. Troubleshooting

### Root folder OK, Path share LAN gagal

Contoh error:

```text
OK - Root folder lokal: Bisa membuat dan menulis file test di E:\file siap layout.
Gagal - Path share LAN: Path share belum bisa diakses dari komputer ini.
```

Artinya folder lokal bisa ditulis, tetapi UNC share belum bisa dibaca. Cek:

```powershell
net share
Test-Path "\\192.168.0.103\file siap layout\"
```

Pastikan `net share` menampilkan `file siap layout`.

### New-SmbShare Access is denied

PowerShell belum Run as Administrator. Tutup PowerShell, buka ulang dengan `Run as administrator`, lalu ulangi perintah.

### Network path was not found

Cek:

1. IP server benar.
2. Komputer server dan client satu jaringan.
3. Firewall file sharing aktif.
4. Server bisa di-ping:

```powershell
ping 192.168.0.103
Test-NetConnection 192.168.0.103 -Port 445
```

### IP berubah setelah restart

Jika IP berubah, `Path share LAN` di POS ikut rusak. Solusi:

1. Set static IP di Windows, atau
2. Buat DHCP reservation di router, atau
3. Pakai nama komputer jika DNS/NetBIOS jaringan stabil:

```text
\\NAMA-KOMPUTER\file siap layout\
```

Namun untuk jaringan sederhana, IP statis biasanya lebih aman.

### Komputer lain bisa baca tapi tidak bisa simpan

Permission folder atau share belum punya akses tulis. Jalankan lagi di server sebagai Administrator:

```powershell
Grant-SmbShareAccess -Name "file siap layout" -AccountName "Everyone" -AccessRight Change -Force
icacls "E:\file siap layout" /grant "*S-1-1-0:(OI)(CI)M"
```

## 10. Checklist Singkat

Di komputer server:

```powershell
New-Item -ItemType Directory -Force -Path "E:\file siap layout"
New-SmbShare -Name "file siap layout" -Path "E:\file siap layout" -ChangeAccess "Everyone"
icacls "E:\file siap layout" /grant "*S-1-1-0:(OI)(CI)M"
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes
Test-Path "\\IP-SERVER\file siap layout\"
```

Di POS:

```text
Root folder lokal = E:\file siap layout
Path share LAN    = \\IP-SERVER\file siap layout\
Folder share      = file siap layout
```

Jika kedua test POS sudah OK, storage lokal file produksi siap dipakai.
