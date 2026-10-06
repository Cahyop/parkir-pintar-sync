# Parkir Ceria

Buat aplikasi web PWA kasir parkir mobile-first dengan fitur:
1. Pintu Masuk:
- Pilih kategori kendaraan (tarif flat dibayar di awal saat masuk).
- Input nomor plat polisi.
- Cetak struk tiket parkir via Web Bluetooth ke printer thermal 58mm/80mm (ESC/POS) berisi nama lokasi parkir, nomor tiket, nomor plat, waktu masuk, tarif lunas, dan QR code tiket.
2. Pintu Keluar:
- Scan QR code tiket menggunakan kamera HP (atau input nomor tiket manual).
- Validasi status tiket: memastikan tiket valid, status sudah lunas, dan menandai kendaraan telah keluar sehingga tiket tidak dapat digunakan dua kali.
3. Master Data Tarif:
- Pengaturan tarif fleksibel: bisa tambah, edit, dan hapus kategori kendaraan beserta nominal tarif flatnya.
4. Realtime Sync & Notifikasi:
- Sinkronisasi data realtime (Lovable Cloud / Supabase database) sehingga jika dijalankan di beberapa HP, data kendaraan masuk/keluar langsung terupdate dan muncul notifikasi saat ada kendaraan baru masuk atau keluar.
5. Rekap Kas Harian:
- Ringkasan total kendaraan terparkir, kendaraan keluar, dan total pendapatan kas hari ini.
6. Support PWA (Progressive Web App) agar dapat diinstall langsung di HP seperti aplikasi native.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://parkir-pintar-sync.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/56f85b8e-f374-45e6-b86f-c7c2a5acf01a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
