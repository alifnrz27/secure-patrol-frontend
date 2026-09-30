# Secure Patrol — Web Admin

Web admin untuk memantau patroli dan mengelola data Secure Patrol. Semua fitur backend tersedia kecuali scan NFC
(scan hanya dari aplikasi mobile).

## Menjalankan

```bash
cp .env.example .env.local   # isi VITE_API_BASE_URL, VITE_APP_ID, VITE_APP_KEY
npm install
npm run dev                  # http://localhost:5173
npm test                     # unit test (Vitest)
npm run typecheck
npm run build && npm run preview   # build produksi, preview di http://localhost:4173 dengan CSP aktif
```

| Variabel | Keterangan |
|---|---|
| `VITE_API_BASE_URL` | URL backend tanpa trailing slash, mis. `http://127.0.0.1:3010`. Path API selalu `/api/v1/...` |
| `VITE_APP_ID` / `VITE_APP_KEY` | App Client **platform `web`** khusus web admin (`go run . create-app-client -name "Secure Patrol Web" -platform web`) |

App Key ikut terbawa di bundle JavaScript, jadi tidak benar-benar rahasia. Perlindungan sebenarnya adalah login,
role, dan pembatasan platform. Pakai App Client web tersendiri agar bisa dirotasi tanpa mengganggu aplikasi mobile.
File `.env*` tidak di-commit (kecuali `.env.example`).

## Deploy dengan Docker Compose (port 9002)

```bash
cp .env.example .env        # isi VITE_API_BASE_URL, VITE_APP_ID, VITE_APP_KEY
docker compose up -d --build
# buka http://<server>:9002
```

- `VITE_API_BASE_URL` adalah alamat backend **yang dibuka browser pengguna** (mis. `https://api.domain.com`), bukan
  `localhost` milik server.
- Nilai `VITE_*` dimasukkan saat build. Setelah mengubah `.env`, jalankan lagi `docker compose up -d --build`.
- Image: build dengan Node 22, lalu disajikan oleh nginx (`docker/nginx.conf.template`) dengan SPA fallback, gzip,
  cache 1 tahun untuk `/assets`, `index.html` tanpa cache, dan header keamanan (`docker/security-headers.inc.template`,
  CSP `connect-src` otomatis diisi dari `VITE_API_BASE_URL`).
- Health check: `GET /healthz`. Port di host bisa diganti dengan `WEB_PORT` di `.env`.
- Untuk HTTPS, pasang reverse proxy (mis. nginx/Caddy/Traefik di host) di depan port 9002. HTTPS juga membuat Web Locks
  aktif untuk refresh token lintas tab.

## Stack

Vite 8 + React 18 + TypeScript (strict), React Router 7, TanStack Query 5, react-hook-form + zod, Mantine 7
(core, dates, dropzone, modals, notifications), `@tabler/icons-react`, `@noble/hashes`, Leaflet + react-leaflet 4
(tile OpenStreetMap), `@dnd-kit`, react-markdown + remark-gfm, Tiptap 3 + `@tiptap/markdown` (editor WYSIWYG
Help Desk), dayjs (utc, timezone), Recharts, Vitest + Testing Library.

Semua library dipasang lewat npm dan ikut di-bundle; tidak ada yang dimuat dari CDN. Satu-satunya sumber eksternal
adalah tile peta OpenStreetMap.

## Struktur folder

```
src/
  api/              fungsi per resource (users, roles, patrol, helpDesk, ...)
  app/              App (provider), router, guard (RequireAuth/RequirePermission), layout + menu
  components/       komponen bersama: SecureImage, ScanDetailDrawer, tabel, filter, badge, state (loading/empty/error)
    maps/           peta Leaflet: status titik, pemilih lokasi, lokasi scan
  config/env.ts     variabel lingkungan
  hooks/            useSession/usePermission, useUrlFilters (filter di query string)
  lib/
    api/            signing (HMAC), clock (koreksi jam), client (apiFetch), errors, types
    auth/session.ts sesi: token di memori, refresh token di localStorage, refresh lintas tab
    permissions.ts  tabel hak akses per role
    csv, format, formErrors, pagination, validation, notify
  pages/            satu folder per menu
```

## Cara kerja inti

- **`apiFetch`** (`src/lib/api/client.ts`) dipakai semua request, termasuk unduhan gambar. Ia membangun URL dengan
  `URLSearchParams`, menandatangani `pathname + search` yang sama persis, dan menyerialisasi `FormData` sendiri
  (`new Response(formData)`) agar byte yang ditandatangani sama dengan yang dikirim. Aturan retry:
  - 401 `Unauthorized app` + timestamp → offset jam diperbarui dari header `Date`, ulang sekali.
  - 401 `Unauthorized app` + nonce → ulang sekali dengan nonce baru.
  - 401 `Unauthorized app` lainnya → "Konfigurasi aplikasi tidak valid" (tidak logout).
  - 401 `Unauthorized` → refresh sekali lalu ulang; gagal → sesi berakhir, ke `/login?expired=1&redirect=...`.
- **Jam**: `GET {BASE_URL}/health` saat aplikasi dimuat mengisi offset. Setiap response dengan header `Date` ikut
  mengoreksi offset jika selisihnya ≥ 2 detik.
- **Sesi** (`src/lib/auth/session.ts`): access token hanya di memori, refresh token di `localStorage`. Refresh
  berjalan single-flight di dalam tab dan lintas tab lewat Web Locks (`sp-refresh`). Di dalam lock, refresh token
  dibaca ulang; jika tab lain sudah refresh, hasilnya dipakai dari `BroadcastChannel("sp-auth")`. Tab baru meminta
  access token dari tab lain dulu sebelum memakai refresh token. Refresh proaktif ~1 menit sebelum `expires_at`.
  Logout disiarkan ke semua tab.
- **Gambar terproteksi**: `<SecureImage>` mengambil blob lewat `apiFetch`, menampilkan object URL, dan me-revoke saat
  unmount. Cache hanya di memori (TanStack Query) dan dihapus saat logout.
- **App Key** hasil buat/rotasi App Client tidak lewat `useMutation`, sehingga tidak tersimpan di cache. Key hanya ada
  di state modal sampai modal ditutup.
- **Help Desk**: isi artikel ditulis dengan editor WYSIWYG (Tiptap) yang membaca dan menyimpan **Markdown**, format
  yang disimpan backend dan dibaca aplikasi mobile. Toolbar hanya berisi format yang bisa disimpan sebagai Markdown
  (tebal, miring, coret, kode, judul, daftar, kutipan, garis, tautan, tabel). Tautan selain http(s)/mailto dibuang,
  termasuk dari konten lama. Urutan artikel hanya diubah dengan drag & drop langsung di daftar (tanpa field urutan),
  dan hanya saat pencarian/filter kosong karena server butuh semua artikel kategori itu.
- **Markdown** dirender tanpa `rehype-raw` dan tanpa `dangerouslySetInnerHTML`. HTML mentah tampil sebagai teks,
  tautan `javascript:` dibuang, dan gambar eksternal ditampilkan sebagai teks karena CSP.

## Hak akses menu

| Menu | super_admin | security_manager | security_head, security_admin |
|---|---|---|---|
| Dashboard, Monitoring Patroli, Titik per Shift/Periode, Riwayat Scan, Laporan, Help Desk, Profil | ✓ | ✓ | ✓ |
| Titik Patroli, Pengaturan Shift, Pengguna, Role | ✓ | ✓ | |
| App Client, Log Aktivitas | ✓ | | |

- `security_team` (dan role kustom) **tidak bisa memakai web admin**. Jika login berhasil di server, sesi yang baru
  dibuat langsung di-logout dan muncul pesan "Akun Anda tidak memiliki akses ke web admin". Pengecekan yang sama
  dilakukan saat sesi dipulihkan (mis. role diganti).
- Tambah/ubah/hapus Role dan mengelola user Super-Admin tetap khusus Super-Admin.
- **Log Aktivitas** (`GET /audit-logs`) sengaja hanya untuk Super-Admin, walaupun backend juga mengizinkan Manager
  Keamanan. Untuk membukanya bagi Manager, ubah `viewAuditLogs` di `src/lib/permissions.ts`.
- Kepala dan Admin Keamanan tetap bisa mengelola artikel Help Desk.
- Tabel ada di `src/lib/permissions.ts` (diuji di `permissions.test.ts`). Server tetap penentu akhir.

## Content Security Policy (hosting)

Kirim header ini dari web server produksi (ganti URL API). Nilai yang sama dipasang di `npm run preview`
(`vite.config.ts`, fungsi `contentSecurityPolicy`):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://tile.openstreetmap.org; connect-src 'self' https://api.example.com;
  font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

`style-src 'unsafe-inline'` dibutuhkan karena Mantine dan Leaflet memakai atribut style inline. Script tetap hanya
dari origin sendiri. Server juga harus mengembalikan `index.html` untuk semua path (SPA fallback).

## Hasil uji kriteria selesai

Diuji terhadap backend development lokal dengan Chromium (Playwright, skrip di luar repo) dan unit test.

| Kriteria | Hasil |
|---|---|
| Test vector signature (3) + signing multipart | ✅ `src/lib/api/signing.test.ts`, `client.test.ts` |
| Login, reload tetap login; token kedaluwarsa → refresh otomatis | ✅ reload tetap login; 401 `Token is expired` (disimulasikan dengan intercept) → 1× refresh nyata → request diulang |
| Dua tab, token kedaluwarsa bersamaan → satu refresh | ✅ tercatat tepat 1 panggilan `/auth/refresh`, kedua tab tetap login, reload sesudahnya tetap login |
| Jam dimajukan 10 menit | ✅ login dan request berhasil; dengan `/health` diblokir: 1× 401 lalu retry berhasil |
| Menu & tombol sesuai role (5 role) | ✅ sesuai tabel "Hak akses menu"; URL menu terlarang menampilkan halaman 403; `security_team` ditolak saat login |
| Foto 5 MB diterima; > 5 MB / bukan gambar ditolak sebelum upload | ✅ 0 request terkirim untuk file 6 MB dan file teks berekstensi .jpg (cek magic bytes) |
| Foto wajah & foto scan lewat `<SecureImage>` | ✅ avatar di daftar pengguna/profil, foto scan + lightbox |
| Titik patroli via peta; NFC ganda → error di field | ✅ |
| Shift tumpang tindih ditolak; timeline shift aktif | ✅ pesan server tampil di field jam mulai; pratinjau timeline di form |
| Help desk: urutan drag & drop tersimpan setelah reload; `<script>` tidak dieksekusi | ✅ drag langsung di daftar; editor WYSIWYG menyimpan Markdown yang bersih (diuji dua arah di `markdown.test.ts`) |
| App Client: key tampil sekali; client web yang dipakai tidak bisa dihapus/dinonaktifkan | ✅ modal tidak bisa ditutup sebelum dicentang; key hilang dari DOM setelah ditutup |
| Riwayat scan: filter, detail (peta, foto), ekspor sesuai filter | ✅ Excel dari server (`/patrol-scans/export`) dan CSV di browser (UTF-8 + BOM, progres + batal) |
| Laporan: tabel, grafik, ekspor CSV | ✅ |
| Build produksi di bawah CSP | ✅ tidak ada pelanggaran CSP |

Belum diuji langsung: refresh **proaktif** oleh timer (butuh menunggu masa berlaku token habis; logikanya sama
dengan jalur yang sudah diuji), serta drag & drop dengan keyboard (sudah didukung lewat `KeyboardSensor`).

## Keputusan yang diambil sendiri

- **React 18** sesuai brief, sehingga memakai Mantine 7 dan react-leaflet 4 (versi terbaru keduanya butuh React 19).
- **`@tabler/icons-react`** ditambahkan untuk ikon (pasangan standar Mantine), satu-satunya library di luar daftar.
- **Web Locks butuh secure context** (HTTPS atau `localhost`). Jika web dibuka lewat HTTP dengan IP LAN, refresh hanya
  single-flight di dalam tab. Pengecekan ulang refresh token dan broadcast tetap berjalan, tetapi race antar-tab masih
  mungkin terjadi. Di produksi (HTTPS) hal ini tidak berlaku.
- Tab baru **meminta access token dari tab lain** (BroadcastChannel, 400 ms) sebelum memakai refresh token, agar
  membuka banyak tab tidak memutar refresh token setiap kali.
- Saat dimuat, aplikasi memanggil `/auth/me` dan `/app-config` sesudah mendapat token (sesuai 5.3).
- Grafik laporan satu seri (persentase penyelesaian harian) dengan satu sumbu. Jumlah temuan ada di tabel dan kartu,
  bukan sumbu kedua. Group `upcoming` tidak dihitung dalam persentase.
- Titik "Terlewat" = belum di-scan pada group yang `end_at`-nya sudah lewat (dihitung dengan jam server).
- Validasi foto memeriksa ukuran dan **magic bytes** JPEG/PNG, karena `file.type` di browser hanya berdasarkan ekstensi.
- Format kode NFC hanya berupa petunjuk, bukan validasi ketat, karena data seed memakai `DUMMY-NFC-0001`.
- Ekspor CSV menetralkan sel yang diawali `= + - @` (CSV/formula injection).
- Role kustom (di luar 5 role sistem) tidak mendapat akses web admin.
- Semua peta dibungkus `isolation: isolate` agar z-index Leaflet tidak menimpa drawer, modal, atau menu.

## Permintaan ke backend

1. **Daftar petugas untuk Kepala dan Admin Keamanan** (filter "Petugas" di Riwayat Scan). Menu Pengguna (`GET /users`)
   hanya untuk Super-Admin dan Manager, jadi filter ini disembunyikan untuk Kepala dan Admin Keamanan. Usulan endpoint
   ringan yang boleh dipakai semua role web:

   ```
   GET /api/v1/patrol-officers?search=budi&limit=100
   200 { "data": { "items": [ { "id": 6, "name": "Budi Santoso", "email": "budi@securepatrol.local" } ],
                   "pagination": { ... } } }
   ```

2. **Koordinat titik saat scan di detail scan.** Detail scan tidak memuat lat/long titik, sehingga web memanggil
   `GET /patrol-points/{id}`. Hasilnya lokasi **saat ini** (bisa sudah dipindah) atau 404 jika titik dihapus. Usulan:
   tambahkan `latitude`/`longitude` salinan dari `patrol_list_item` ke `patrol_point` pada `PatrolScan`:

   ```json
   "patrol_point": { "patrol_list_item_id": 12, "patrol_point_id": 2, "name": "Parking Area",
                     "location": "Basement 1", "nfc_code": "04:A2:1F:9C",
                     "latitude": -6.2252431, "longitude": 106.8011502 }
   ```

3. **Endpoint baca tetap terbuka untuk Kepala/Admin Keamanan.** Menu Titik Patroli dan Pengaturan Shift
   disembunyikan untuk mereka, tetapi halaman yang boleh mereka buka tetap memakai `GET /patrol-points` (filter titik di
   Riwayat Scan, peta di detail scan) dan `GET /patrol-shifts` (filter shift di Monitoring, Titik per Shift, Riwayat
   Scan, Laporan). Saat memblokir menu di backend, cukup blokir `POST/PUT/DELETE`, jangan `GET`. Jika `GET` ikut
   diblokir, filter tersebut kosong dan peta detail scan hanya menampilkan posisi scan.
   Pesan 403 saat `security_team` login dari web sebaiknya berbeda dari "account is inactive", misalnya
   `this role is not allowed to use the web admin` (sudah diterjemahkan di frontend).

4. **(Opsional) Agregat laporan.** Laporan saat ini mengambil semua halaman `/patrol-groups` (≤ 31 hari × jumlah
   shift). Cukup untuk sekarang; jika shift bertambah banyak, endpoint agregat akan lebih ringan:
   `GET /api/v1/patrol-reports/daily?date_from=2026-09-01&date_to=2026-09-30&shift_id=` →
   `[{ "date": "2026-09-01", "shift_id": 1, "total_points": 15, "scanned_points": 14, "total_scans": 20, "abnormal_scans": 1 }]`.

5. **Ekspor Excel (`GET /patrol-scans/export`)**:
   - Dukung filter `condition` dan `group_id` seperti `GET /patrol-scans`. Saat ini keduanya diabaikan, jadi web
     menonaktifkan pilihan Excel ketika filter tersebut aktif dan menyarankan CSV.
   - Tambahkan `Content-Disposition` ke `Access-Control-Expose-Headers` agar web bisa memakai nama file dari server
     (sekarang nama dibuat di web dengan pola yang sama).
