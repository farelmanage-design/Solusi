# Setup Database Neon di Vercel

Project ini memakai Neon Postgres lewat Vercel Function `/api/state`. Browser tidak menyimpan `DATABASE_URL`, jadi koneksi database tetap berada di server.

## 1. Buat Neon dari Vercel

1. Buka dashboard Vercel project.
2. Masuk tab Storage atau Marketplace.
3. Tambahkan Neon Postgres.
4. Pastikan environment variable `DATABASE_URL` tersedia di project Vercel.

## 2. Buat Tabel

Tabel akan dibuat otomatis oleh `/api/state` saat pertama dipanggil. Kalau ingin manual, jalankan isi `database.sql` di Neon SQL Editor.

## 3. Deploy

Jalankan deploy ke Vercel seperti biasa. Vercel akan memasang dependency dari `package.json` dan membuat endpoint:

```txt
/api/state
```

## Cara Sinkron

- Admin dan teknisi tetap cepat karena UI langsung memakai data lokal.
- Setiap perubahan disimpan ke Neon lewat `/api/state`.
- Halaman lain mengecek update terbaru setiap beberapa detik tanpa refresh halaman.
- Jika koneksi database gagal, data lokal tetap aman dan app tetap bisa dipakai sementara.

## Catatan Realtime

Neon adalah Postgres server-side, bukan realtime browser channel seperti Supabase. Karena itu sinkron dibuat dengan polling ringan `pollIntervalMs` di `config.js`. Default-nya `2500ms`, cukup halus untuk kasir dan teknisi tanpa terlihat halaman refresh.
