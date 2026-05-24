# Mulazamah · Sistem Input Data Santri

Aplikasi web untuk input data harian santri Mahad Mulazamah Al-Azhar — absensi, tahfidz, kitab — terhubung langsung ke Google Sheets via Sheets API.

🌐 **Live:** https://gen-lang-client-0455733553.web.app
🏛 **Institusi:** Mahad Mulazamah Al-Azhar
📦 **GitHub:** [rhdr1/Data-sheet-input](https://github.com/rhdr1/Data-sheet-input)

---

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Firebase Auth** — Google OAuth dengan scope `spreadsheets`
- **Google Sheets API v4** — client-side, akses spreadsheet milik user yang login
- **TailwindCSS v4** (theme via CSS variables) + **Motion** + **lucide-react**
- **Hosting:** Firebase Hosting (Spark plan, free)

## Fitur

- Login Google (akun mana saja yang punya akses ke spreadsheet target)
- Auto-detect tabs/sheets dalam spreadsheet
- Audit cell kosong per sheet
- Form absensi dengan filter kelas, rubrik per santri, batch submit
- Lock sheet tujuan supaya tidak terganti tak sengaja
- Lima tema visual: Mushaf (cerah), Tarbiyyah, Madinah, Qahwah, Lailatul
- Mobile-first responsive

---

## Setup lokal

```bash
git clone https://github.com/rhdr1/Data-sheet-input.git
cd Data-sheet-input
npm install
npm run dev
```

App akan jalan di `http://localhost:3000`.

## Build & Deploy

### Build
```bash
npm run build
```
Output ke `dist/`.

### Deploy ke Firebase Hosting
```bash
# Pertama kali (login):
firebase login

# Deploy:
firebase deploy --only hosting
```

URL hasil: https://gen-lang-client-0455733553.web.app

---

## Konfigurasi

### 1. App config — `src/config.ts`

Edit untuk ganti default spreadsheet, sheet tujuan, branding:

```ts
export const APP_CONFIG = {
  defaultSpreadsheetId: "1tDFYy...",  // ganti di sini
  defaultTargetSheet: "gudang",
  // ...
};
```

### 2. Firebase config — `firebase-applet-config.json`

Berisi credentials Firebase (web client). Aman untuk public (OAuth lock di server). Jangan diubah kecuali ganti Firebase project.

> ⚠️ Penting: `authDomain` harus disetel ke hosting domain (`*.web.app`), bukan `*.firebaseapp.com`, untuk menghindari masalah `sessionStorage` di iOS Safari.

### 3. OAuth Client (Google Cloud)

URL: https://console.cloud.google.com/apis/credentials?project=gen-lang-client-0455733553

Wajib ada di **Authorized redirect URIs:**
```
https://gen-lang-client-0455733553.web.app/__/auth/handler
https://gen-lang-client-0455733553.firebaseapp.com/__/auth/handler
```

### 4. OAuth Consent Screen

URL: https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0455733553

- **User Type:** External
- **Publishing Status:** In production *(supaya semua akun Google bisa login, bukan hanya test users)*

---

## Struktur kode

```
src/
├── App.tsx                       # Root component — header, auth, settings modal
├── main.tsx                      # Entry point dengan ErrorBoundary
├── firebase.ts                   # Firebase auth setup, signInWithPopup + redirect fallback
├── config.ts                     # App-level config (spreadsheet ID, branding)
├── types.ts                      # TypeScript interfaces
├── index.css                     # Theme variables, fonts, ornaments
├── components/
│   ├── AttendanceForm.tsx        # Main form workflow (kelas, rubrik, batch submit)
│   ├── GsiButton.tsx             # Google Sign-In button
│   ├── SpreadsheetLoader.tsx     # Spreadsheet URL/ID input + load
│   └── ErrorBoundary.tsx         # Crash handler
└── lib/
    └── sheetsService.ts          # Google Sheets API helpers (fetch info, audit, append)
```

---

## Cara kerja autentikasi

1. User klik "Masuk dengan Google" → `signInWithPopup` (popup) atau fallback ke `signInWithRedirect` (Mobile Safari).
2. Setelah authorize, dapat OAuth access token (scope `spreadsheets`).
3. Token disimpan di `localStorage` (expiry 55 menit).
4. Semua request Sheets API pakai access token user (bukan service account).
5. Kalau token expired, app auto-refresh via popup pas user click action berikutnya.

> Data **tidak pernah lewat backend** — langsung dari browser ke Sheets API. Privasi user terjaga.

---

## Troubleshooting

### "Access blocked: This app's request is invalid" (Error 400 redirect_uri_mismatch)
→ Pastikan `https://gen-lang-client-0455733553.web.app/__/auth/handler` terdaftar di **Authorized redirect URIs** di OAuth Client.

### "Unable to save initial state. sessionStorage inaccessible" (iOS Safari)
→ Pastikan `authDomain` di `firebase-applet-config.json` set ke **hosting domain** (`*.web.app`), bukan `*.firebaseapp.com`.

### "App belum di-verify Google"
→ Set OAuth Consent Screen ke **Production** + (opsional) submit untuk verifikasi resmi Google.

### Token expired di tengah session
→ Sudah di-handle: `ensureValidToken()` akan auto re-popup. Klik tombol aksi → popup muncul → user re-authorize.

---

## License

Internal — Mahad Mulazamah Al-Azhar.

Built with care for the staff and students of Yasalam.
