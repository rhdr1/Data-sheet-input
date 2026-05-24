import { useEffect, useState, startTransition } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout, ensureValidToken } from "./firebase";
import {
  fetchSpreadsheetInfo,
  fetchSheetAudit,
  appendRow,
  appendMultipleRows,
} from "./lib/sheetsService";
import { SpreadsheetInfo, SheetAudit } from "./types";
import { GsiButton } from "./components/GsiButton";
import { SpreadsheetLoader } from "./components/SpreadsheetLoader";
import { AttendanceForm } from "./components/AttendanceForm";
import { APP_CONFIG } from "./config";

/** Skeleton placeholder shown while initial data loads. */
function SkeletonCard({ rows = 3, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-sm p-5 overflow-hidden" style={{ minHeight: tall ? 500 : "auto" }}>
      <div className="absolute inset-2 border pointer-events-none" style={{ borderColor: "var(--color-gold)", opacity: 0.08 }} />
      <div className="relative space-y-3">
        <div className="h-3 bg-zinc-800/70 rounded-sm shimmer" style={{ width: "40%" }} />
        <div className="h-2 bg-zinc-800/50 rounded-sm shimmer" style={{ width: "70%" }} />
        <div className="pt-3 space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-9 bg-zinc-800/40 rounded-sm shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
import {
  FileSpreadsheet,
  LogOut,
  UserCheck,
  Settings,
  X,
  Lock,
  Unlock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Spreadsheet state — default from APP_CONFIG, user can override via Settings
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(
    () => localStorage.getItem("last_spreadsheet_id") || APP_CONFIG.defaultSpreadsheetId
  );

  // Persist last used spreadsheet so it's remembered next session
  useEffect(() => {
    if (currentSpreadsheetId) {
      localStorage.setItem("last_spreadsheet_id", currentSpreadsheetId);
    }
  }, [currentSpreadsheetId]);
  const [spreadsheetInfo, setSpreadsheetInfo] =
    useState<SpreadsheetInfo | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("");
  const [audits, setAudits] = useState<Record<string, SheetAudit>>({});

  // Loading/Feedback states
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isLoadingAudits, setIsLoadingAudits] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);

  // App settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [targetSheetName, setTargetSheetName] = useState(APP_CONFIG.defaultTargetSheet);
  const [isTargetLocked, setIsTargetLocked] = useState(false);
  const [appTheme, setAppTheme] = useState("dark"); // 'dark' | 'navy' | 'coffee' | 'midnight'

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  // Init auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Handle manual sign in
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSpreadsheetError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error("Authentication failed:", err);
      setSpreadsheetError(`Login authentication failed. Please verify popup blocks or permissions: ${err?.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle manual logout
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setSpreadsheetInfo(null);
      setSelectedTab("");
      setAudits({});
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleLoadSpreadsheet = async (id: string) => {
    try {
      const validToken = await ensureValidToken();
      if (!validToken) throw new Error("Gagal memverifikasi sesi Google (Akses Ditolak).");
      setToken(validToken); // Ensure token state is fresh
      setCurrentSpreadsheetId(id);
    } catch (err: any) {
      setSpreadsheetError(err?.message || "Gagal memperbarui sesi.");
    }
  };
  useEffect(() => {
    if (!token || !currentSpreadsheetId) return;

    let active = true;
    setIsLoadingInfo(true);
    setSpreadsheetError(null);

    fetchSpreadsheetInfo(token, currentSpreadsheetId)
      .then((info) => {
        if (!active) return;
        setSpreadsheetInfo(info);
        if (info.sheets.length > 0) {
          // Default selection: select first tab
          startTransition(() => {
            setSelectedTab(info.sheets[0].title);
          });
        }
      })
      .catch((err: any) => {
        if (!active) return;
        console.error(err);
        setSpreadsheetError(err?.message || "Failed to load spreadsheet catalog. Please verify URL exists and you have permissions.");
        setSpreadsheetInfo(null);
      })
      .finally(() => {
        if (active) {
          setIsLoadingInfo(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token, currentSpreadsheetId]);

  // Bulk audit fetcher for all tabs
  useEffect(() => {
    if (!token || !currentSpreadsheetId || !spreadsheetInfo) return;

    let active = true;
    setIsLoadingAudits(true);

    const sheetsList = spreadsheetInfo.sheets;
    const fetchAllAudits = async () => {
      const resultRecord: Record<string, SheetAudit> = {};
      
      // Execute in parallel to keep things incredibly rapid and high performance
      await Promise.all(
        sheetsList.map(async (sheet) => {
          try {
            const auditData = await fetchSheetAudit(
              token,
              currentSpreadsheetId,
              sheet.title
            );
            if (active) {
              resultRecord[sheet.title] = auditData;
            }
          } catch (e) {
            console.error(`Audit fetching failed for tab "${sheet.title}":`, e);
          }
        })
      );

      if (active) {
        setAudits(resultRecord);
        setIsLoadingAudits(false);
      }
    };

    fetchAllAudits();

    return () => {
      active = false;
    };
  }, [token, currentSpreadsheetId, spreadsheetInfo]);

  // Append entry handler
  const handleAppendRow = async (values: string[]) => {
    if (!currentSpreadsheetId || !selectedTab) return;
    setIsModifying(true);
    try {
      const validToken = await ensureValidToken();
      if (!validToken) throw new Error("Gagal memverifikasi sesi Google (Akses Ditolak).");
      setToken(validToken); // Update React state if it changed

      await appendRow(validToken, currentSpreadsheetId, selectedTab, values);
      
      // Immediately run targeted audit refresh for the updated sheet tab to update progress instantly
      const updatedAudit = await fetchSheetAudit(
        validToken,
        currentSpreadsheetId,
        selectedTab
      );
      setAudits((prev) => ({
        ...prev,
        [selectedTab]: updatedAudit,
      }));
    } finally {
      setIsModifying(false);
    }
  };

  // Specific sheet append handler to write to a target tab (like 'gudang')
  const handleAppendRowToSheet = async (sheetName: string, values: string[]) => {
    if (!currentSpreadsheetId) return;
    setIsModifying(true);
    try {
      const validToken = await ensureValidToken();
      if (!validToken) throw new Error("Gagal memverifikasi sesi Google (Akses Ditolak).");
      setToken(validToken); // Update React state if it changed

      await appendRow(validToken, currentSpreadsheetId, sheetName, values);
      
      // Refresh targeted audit for the target sheet (e.g. gudang)
      const updatedAudit = await fetchSheetAudit(
        validToken,
        currentSpreadsheetId,
        sheetName
      );
      setAudits((prev) => ({
        ...prev,
        [sheetName]: updatedAudit,
      }));
    } finally {
      setIsModifying(false);
    }
  };

  // Specific sheet append multiple rows handler to write to a target tab (like 'gudang')
  const handleAppendMultipleRowsToSheet = async (sheetName: string, rows: string[][]) => {
    if (!currentSpreadsheetId) return;
    setIsModifying(true);
    try {
      const validToken = await ensureValidToken();
      if (!validToken) throw new Error("Gagal memverifikasi sesi Google (Akses Ditolak).");
      setToken(validToken); // Update React state if it changed

      await appendMultipleRows(validToken, currentSpreadsheetId, sheetName, rows);
      
      // Refresh targeted audit for the target sheet (e.g. gudang)
      const updatedAudit = await fetchSheetAudit(
        validToken,
        currentSpreadsheetId,
        sheetName
      );
      setAudits((prev) => ({
        ...prev,
        [sheetName]: updatedAudit,
      }));
    } finally {
      setIsModifying(false);
    }
  };

  return (
    <div id="full-app-root" className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased pb-24 relative overflow-x-hidden">
      {/* Background atmosphere — radial warmth + ornament */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.45 0 0 0 0 0.30 0 0 0 0.8 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60rem] h-[40rem] rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(closest-side, var(--color-gold), transparent 70%)" }} />
        <div className="absolute -bottom-40 right-0 w-[40rem] h-[40rem] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(closest-side, var(--color-emerald-500), transparent 70%)" }} />
      </div>

      {/* Top Header Navigation bar — editorial style */}
      <header className="relative bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/60 sticky top-0 z-40">
        {/* Gold hairline accent */}
        <div className="absolute inset-x-0 top-0 h-px" style={{
          background: "linear-gradient(to right, transparent, var(--color-gold) 25%, var(--color-gold) 75%, transparent)",
          opacity: 0.45,
        }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Crest mark — checklist + pen */}
            <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-md border" style={{
                borderColor: "var(--color-gold)",
                opacity: 0.5,
              }} />
              <div className="absolute inset-1 rounded-sm" style={{ background: "var(--color-emerald-900)" }} />
              <svg viewBox="0 0 32 32" className="relative w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-gold-pale)" }}>
                {/* Document */}
                <path d="M9 5 L20 5 L24 9 L24 25 L9 25 Z" />
                {/* Folded corner */}
                <path d="M20 5 L20 9 L24 9" />
                {/* Checkbox 1 */}
                <rect x="11.5" y="11.5" width="2" height="2" rx="0.3" />
                <path d="M15 12.5 L19.5 12.5" />
                {/* Checkbox 2 */}
                <rect x="11.5" y="15.5" width="2" height="2" rx="0.3" />
                <path d="M15 16.5 L19.5 16.5" />
                {/* Checkbox 3 */}
                <rect x="11.5" y="19.5" width="2" height="2" rx="0.3" />
                <path d="M15 20.5 L17.5 20.5" />
                {/* Pencil accent */}
                <path d="M22.5 17 L27 21.5 L25 23.5 L20.5 19 Z" stroke="var(--color-gold)" strokeWidth="1.2" />
                <path d="M20.5 19 L20 24 L25 23.5" stroke="var(--color-gold)" strokeWidth="1.2" />
              </svg>
            </div>

            {/* Wordmark */}
            <div className="flex flex-col leading-tight">
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-lg sm:text-xl text-zinc-100 tracking-tight font-medium">
                  Mulazamah
                </h1>
                <span className="font-arabic text-base text-zinc-400 hidden sm:inline" dir="rtl">المُلازَمَة</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-medium tracking-[0.18em] uppercase">
                Sistem Input Data Santri
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-full">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-7 h-7 rounded-full border"
                    style={{ borderColor: "var(--color-gold)" }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 text-zinc-950 text-xs font-bold rounded-full flex items-center justify-center font-display"
                    style={{ background: "var(--color-gold)" }}>
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-[11px] font-semibold text-zinc-200 leading-tight font-sans">
                    {user.displayName}
                  </p>
                  <p className="text-[9px] text-zinc-500 truncate max-w-[140px] font-mono">
                    {user.email}
                  </p>
                </div>
                <button
                  id="header-settings-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 transition-colors ml-1 cursor-pointer rounded-full"
                  title="Pengaturan"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  id="header-logout-btn"
                  onClick={handleLogout}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer rounded-full"
                  title="Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame container */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-14 space-y-8">
        {/* Auth Block overlay if needed credentials are unauthenticated */}
        {needsAuth ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-lg mx-auto mt-6 sm:mt-12"
          >
            {/* Eyebrow */}
            <div className="text-center mb-3">
              <span className="inline-block text-[10px] tracking-[0.45em] uppercase font-bold text-zinc-500">
                Sistem Mahad
              </span>
            </div>

            {/* Card */}
            <div className="relative bg-zinc-900/70 backdrop-blur-sm border border-zinc-800 rounded-sm overflow-hidden">
              {/* Inner gold hairline */}
              <div className="absolute inset-[6px] border pointer-events-none" style={{ borderColor: "var(--color-gold)", opacity: 0.18 }} />

              <div className="relative px-7 sm:px-10 py-10 sm:py-12 text-center">
                {/* Bismillah — Arabic ornament */}
                <p className="font-arabic text-2xl sm:text-[28px] leading-tight mb-6"
                  style={{ color: "var(--color-gold-pale)" }} dir="rtl">
                  ﷽
                </p>

                {/* Display heading */}
                <h2 className="font-display text-3xl sm:text-4xl text-zinc-50 leading-[1.05] tracking-tight mb-3"
                  style={{ fontWeight: 400 }}>
                  Selamat datang,
                  <br />
                  <em className="not-italic" style={{ fontStyle: "italic", color: "var(--color-emerald-400)" }}>Ustadz.</em>
                </h2>

                {/* Sub */}
                <p className="text-sm text-zinc-400 mb-1 leading-relaxed max-w-sm mx-auto">
                  Masuk dengan akun Google njenengan untuk membuka spreadsheet santri dan mulai menginput data harian.
                </p>

                {/* Ornament */}
                <div className="ornament-divider my-7 max-w-[200px] mx-auto">
                  <span className="ornament-glyph">✦</span>
                </div>

                <GsiButton onClick={handleLogin} isLoading={isLoggingIn} />

                {/* Footer */}
                <p className="text-[10px] text-zinc-600 mt-7 leading-relaxed font-mono">
                  Akses scope: <span className="text-zinc-500">drive.spreadsheets · profile</span>
                  <br />
                  Token tersimpan terenkripsi di perangkat anda.
                </p>
              </div>
            </div>

            {spreadsheetError && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="mt-5 p-4 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-sm text-xs font-medium leading-relaxed">
                {spreadsheetError}
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* Main Workspace Dashboard */
          <div className="space-y-8 animate-fadeIn">
            {/* Attendance Form Dashboard */}
            {spreadsheetInfo ? (
              <AttendanceForm
                audits={audits}
                sheets={spreadsheetInfo.sheets}
                onAppendMultipleRowsToSheet={handleAppendMultipleRowsToSheet}
                isModifying={isModifying}
                targetSheetName={targetSheetName}
                userId={user?.uid}
              />
            ) : (
              /* Loading skeleton — shown while initial spreadsheet info & audits fetch */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <SkeletonCard rows={2} />
                  <SkeletonCard rows={2} />
                </div>
                <div className="lg:col-span-8">
                  <SkeletonCard rows={6} tall />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-zinc-900 border border-zinc-800 rounded-sm overflow-hidden w-full max-w-2xl"
            >
              {/* Gold hairline accent */}
              <div className="absolute inset-x-0 top-0 h-px" style={{
                background: "linear-gradient(to right, transparent, var(--color-gold) 50%, transparent)",
                opacity: 0.5,
              }} />

              <div className="flex items-center justify-between px-7 py-5 border-b border-zinc-800/80">
                <div className="flex items-baseline gap-3">
                  <span className="text-[9px] tracking-[0.4em] uppercase font-bold" style={{ color: "var(--color-gold)" }}>
                    Configurasi
                  </span>
                  <h2 className="font-display text-xl text-zinc-50 tracking-tight" style={{ fontWeight: 500 }}>
                    Pengaturan
                  </h2>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-zinc-500 hover:text-zinc-100 transition-colors p-1"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-7 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <SpreadsheetLoader
                  currentId={currentSpreadsheetId}
                  spreadsheetTitle={
                    spreadsheetInfo ? spreadsheetInfo.title : ""
                  }
                  onLoadSpreadsheet={handleLoadSpreadsheet}
                  isLoading={isLoadingInfo}
                  error={spreadsheetError}
                />

                <div className="relative bg-zinc-950/60 border border-zinc-800 rounded-sm p-6">
                  <div aria-hidden className="absolute inset-2 border pointer-events-none" style={{
                    borderColor: "var(--color-gold)", opacity: 0.12,
                  }} />
                  <h3 className="relative text-[9px] font-bold tracking-[0.32em] uppercase mb-4" style={{ color: "var(--color-gold)" }}>
                    Sheet Tujuan
                  </h3>
                  <div className="space-y-3">
                    <label htmlFor="target-sheet-input" className="block text-xs font-medium text-zinc-300">
                      Nama Tab/Sheet untuk Menyimpan Data Kehadiran
                    </label>
                    <div className="flex gap-2 items-center">
                      {spreadsheetInfo && spreadsheetInfo.sheets.length > 0 ? (
                        <select
                          id="target-sheet-input"
                          className="block w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-zinc-100 disabled:opacity-50"
                          value={targetSheetName}
                          onChange={(e) => setTargetSheetName(e.target.value)}
                          disabled={isTargetLocked}
                        >
                          {spreadsheetInfo.sheets.map((sheet) => (
                            <option key={sheet.title} value={sheet.title}>
                              {sheet.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="target-sheet-input"
                          type="text"
                          className="block w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-zinc-100 disabled:opacity-50"
                          placeholder="Contoh: gudang"
                          value={targetSheetName}
                          onChange={(e) => setTargetSheetName(e.target.value)}
                          disabled={isTargetLocked}
                        />
                      )}
                      
                      <button
                        onClick={() => setIsTargetLocked(!isTargetLocked)}
                        className={`p-3 border rounded-xl flex shrink-0 items-center justify-center transition-colors ${
                          isTargetLocked 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                        }`}
                        title={isTargetLocked ? "Buka Kunci" : "Kunci Tab Tujuan"}
                      >
                        {isTargetLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2">
                      Pilih atau ketik nama tab/sheet tempat data akan disimpan. Gunakan tombol kunci untuk mencegah perubahan tak disengaja.
                    </p>
                  </div>
                </div>

                <div className="relative bg-zinc-950/60 border border-zinc-800 rounded-sm p-6">
                  <div aria-hidden className="absolute inset-2 border pointer-events-none" style={{
                    borderColor: "var(--color-gold)", opacity: 0.12,
                  }} />
                  <h3 className="relative text-[9px] font-bold tracking-[0.32em] uppercase mb-4" style={{ color: "var(--color-gold)" }}>
                    Tema Tampilan
                  </h3>
                  <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: "paper",    label: "Mushaf",      sub: "Cerah",    bg: "#F4EDDE", border: "#BFAE89", accent: "#2E5D54", textOnLight: true },
                      { id: "dark",     label: "Tarbiyyah",   sub: "Default",  bg: "#18130E", border: "#3D3225", accent: "#B89D5D" },
                      { id: "navy",     label: "Madinah",     sub: "Biru",     bg: "#0C1428", border: "#2A3866", accent: "#82AEEC" },
                      { id: "coffee",   label: "Qahwah",      sub: "Cokelat",  bg: "#221A12", border: "#574231", accent: "#DDA859" },
                      { id: "midnight", label: "Lailatul",    sub: "Lembayung",bg: "#160C2E", border: "#422980", accent: "#A892E4" },
                    ].map(t => {
                      const active = appTheme === t.id;
                      const labelColor = t.textOnLight ? "#18130E" : "var(--color-zinc-50, #F6F0DC)";
                      const subColor = t.textOnLight ? "#5F523A" : "var(--color-zinc-500, #7A6B53)";
                      return (
                        <button
                          key={t.id}
                          onClick={() => setAppTheme(t.id)}
                          className="group relative p-4 rounded-sm border flex flex-col items-start gap-2 transition-all overflow-hidden"
                          style={{
                            background: t.bg,
                            borderColor: active ? t.accent : t.border,
                            boxShadow: active ? `0 0 0 1px ${t.accent}, 0 8px 24px -16px ${t.accent}` : "none",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.accent }} />
                            <span className="font-display text-sm" style={{ fontWeight: 500, color: labelColor }}>{t.label}</span>
                          </div>
                          <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: subColor }}>{t.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
