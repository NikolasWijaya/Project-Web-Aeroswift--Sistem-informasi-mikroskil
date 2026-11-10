# AeroSwift – Website Pemesanan Tiket Pesawat (prototipe)

Versi ini disesuaikan dengan laporan *Analisis Kebutuhan dan Perencanaan Pengujian Website AeroSwift*.
Tidak perlu build: buka `index.html`, atau jalankan server lokal (`python -m http.server`) lalu buka `http://localhost:8000`.

## Alur
Home → (Registrasi/Login) → Flights → Booking → Boarding pass → History

Halaman **Home** dan **Akun** terbuka untuk umum. **Flights, Booking, History** memerlukan login (sesuai sitemap Bab VII).

## Pemetaan requirement → implementasi
| Kode | Implementasi | File |
|---|---|---|
| FR-01 | Registrasi: validasi nama, email, kekuatan kata sandi, konfirmasi, email ganda ditolak | `account.html`, `auth.js` |
| FR-02 | Login, sesi (kedaluwarsa 2 jam), logout, proteksi halaman, redirect ke halaman tujuan | `auth.js`, `script.js` |
| FR-03 | Pencarian: asal ≠ tujuan, tanggal tidak lampau, tanggal kembali ≥ berangkat, penumpang 1–9; hasil sesuai rute | `data.js` (`validateSearch`), `script.js` |
| FR-04 | Kartu destinasi unggulan menautkan ke pencarian dengan tujuan terisi | `index.html` |
| FR-05 | Filter harga, maskapai, jam berangkat (bisa digabung), urutan, reset, pesan "tidak ada hasil" | `script.js` |
| FR-06 | Penerbangan *sold out* tidak bisa dipilih (tombol nonaktif; URL langsung juga ditolak); kursi tidak cukup ditolak | `script.js` |
| FR-07 | Satu form per penumpang, validasi nama/ID/telepon/email, peta kursi tanpa kursi ganda | `booking.html`, `script.js` |
| FR-08 | Rincian biaya (tarif dasar × penumpang + pajak 10% = total); validasi kartu 16 digit, masa berlaku, CVV 3 digit | `script.js` |
| FR-09 | Konfirmasi dan boarding pass hanya muncul setelah pembayaran berhasil; bisa dicetak; per penumpang | `script.js` |
| FR-10 | Riwayat hanya milik akun yang login, detail pemesanan, boarding pass | `history.html`, `script.js` |
| NFR-01 | Kata sandi di-hash dengan salt acak (PBKDF2-SHA-256, 150.000 iterasi); tidak pernah disimpan/dibandingkan sebagai teks biasa | `auth.js` |
| NFR-02 | Nomor kartu ditampilkan sebagian (•••• 1111), CVV tidak disimpan, nomor kartu penuh tidak disimpan | `script.js` |
| NFR-03 | Gambar → WebP responsif (≈ 15 MB → 0,3 MB), video 11 MB → 4 MB, `loading="lazy"`, `preload="none"` + poster | `pic/`, `vid/` |
| NFR-04 | Layout responsif (diuji pada 360 px tanpa scroll horizontal) | `style.css` |
| NFR-05 | Hanya JavaScript/CSS standar tanpa library eksternal | – |
| NFR-06 | Pesan kesalahan per kolom yang menyebut penyebab dan cara memperbaiki | `script.js` |
| NFR-07 | Ketersediaan kursi dicek ulang saat pembayaran; klik ganda tombol bayar tidak membuat pemesanan ganda | `data.js`, `script.js` |

## Catatan penting
* Ini prototipe **front-end saja**: akun, pemesanan, dan kursi disimpan di `localStorage` browser. Di sistem nyata hashing, pembayaran, dan ketersediaan kursi harus di server.
* Untuk memenuhi NFR-02 (HTTPS), publikasikan lewat hosting yang memakai HTTPS (GitHub Pages, Netlify, dll.).
* Data uji: daftarkan akun baru lewat halaman Akun. Kartu uji bebas asalkan 16 digit, masa berlaku belum lewat, CVV 3 digit (mis. `4111 1111 1111 1111`, `12/30`, `123`).
* Rute tersedia: KNO–DPO, KNO–CGK, CGK–DPO, CGK–YIA, CGK–SUB, CGK–BPN, CGK–SOQ, BPN–DPO, YIA–TKG (dua arah). Beberapa penerbangan sengaja *sold out* untuk pengujian FR-06.
* Untuk mengulang pengujian dari awal, hapus data situs di browser (localStorage).
