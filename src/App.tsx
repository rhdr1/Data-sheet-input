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

  // Spreadsheet state
  // Pre-load the spreadsheet ID specified in the prompt
  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(
    "1tDFYyLBJedRa02s5Nb4GAg1Ro22sp-LnmG3nxU2fFys"
  );
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
  const [targetSheetName, setTargetSheetName] = useState("gudang");
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
    <div id="full-app-root" className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased pb-24">
      {/* Top Header Navigation bar */}
      <header className="bg-zinc-900/60 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-zinc-950 p-2.5 rounded-xl font-bold shadow-md shadow-emerald-500/10">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-white tracking-tight text-sm sm:text-base font-display uppercase">
                Aplikasi Input Absensi Guru
              </h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 font-medium">
                Pilih kelas dan input data kehadiran siswa dengan cepat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-6 h-6 rounded-full border border-zinc-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 bg-emerald-500 text-zinc-950 text-xs font-bold rounded-full flex items-center justify-center">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-zinc-200 leading-tight">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>
                <button
                  id="header-settings-btn"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1 text-zinc-400 hover:text-emerald-400 transition-colors ml-2 cursor-pointer"
                  title="Pengaturan"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-zinc-700 mx-1"></div>
                <button
                  id="header-logout-btn"
                  onClick={handleLogout}
                  className="p-1 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Auth Block overlay if needed credentials are unauthenticated */}
        {needsAuth ? (
          <div className="max-w-md mx-auto bg-zinc-900 rounded-3xl border border-zinc-800 p-8 shadow-2xl text-center mt-12">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-6 border border-emerald-500/20">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2 font-display">
              Google Sheet Connection Required
            </h2>
            <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Login securely with Google to inspect spreadsheet tabs structure, view empty cells instantly, and submit perfect row inputs.
            </p>
            <GsiButton onClick={handleLogin} isLoading={isLoggingIn} />
            {spreadsheetError && (
              <div className="mt-6 p-4 bg-rose-950/40 border border-rose-900 text-rose-300 rounded-2xl text-xs font-semibold">
                {spreadsheetError}
              </div>
            )}
          </div>
        ) : (
          /* Main Workspace Dashboard */
          <div className="space-y-8 animate-fadeIn">
            {/* Attendance Form Dashboard */}
            {spreadsheetInfo && (
              <AttendanceForm
                audits={audits}
                sheets={spreadsheetInfo.sheets}
                onAppendRowToSheet={handleAppendRowToSheet}
                onAppendMultipleRowsToSheet={handleAppendMultipleRowsToSheet}
                isModifying={isModifying}
                targetSheetName={targetSheetName}
                userId={user?.uid}
              />
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden w-full max-w-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-500" />
                  Pengaturan
                </h2>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <SpreadsheetLoader
                  currentId={currentSpreadsheetId}
                  spreadsheetTitle={
                    spreadsheetInfo ? spreadsheetInfo.title : ""
                  }
                  onLoadSpreadsheet={handleLoadSpreadsheet}
                  isLoading={isLoadingInfo}
                  error={spreadsheetError}
                />

                <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
                    Sheet Tujuan (Destination)
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

                <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6 shadow-sm">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
                    Tema Aplikasi
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => setAppTheme('dark')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        appTheme === 'dark' 
                          ? 'border-emerald-500 bg-zinc-900 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]' 
                          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-zinc-800 shrink-0"></div>
                      <span className={`text-[11px] font-bold ${appTheme === 'dark' ? 'text-zinc-100' : ''}`}>Dark (Default)</span>
                    </button>
                    
                    <button
                      onClick={() => setAppTheme('navy')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        appTheme === 'navy' 
                          ? 'border-blue-500 bg-[#0f172a] shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]' 
                          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0f172a] border-2 border-[#1e293b] shrink-0"></div>
                      <span className={`text-[11px] font-bold ${appTheme === 'navy' ? 'text-zinc-100' : ''}`}>Navy Blue</span>
                    </button>

                    <button
                      onClick={() => setAppTheme('coffee')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        appTheme === 'coffee' 
                          ? 'border-amber-500 bg-[#3d2a20] shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]' 
                          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#3d2a20] border-2 border-[#573e30] shrink-0"></div>
                      <span className={`text-[11px] font-bold ${appTheme === 'coffee' ? 'text-zinc-100' : ''}`}>Coffee Root</span>
                    </button>

                    <button
                      onClick={() => setAppTheme('midnight')}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        appTheme === 'midnight' 
                          ? 'border-purple-500 bg-[#1e1b4b] shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]' 
                          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1e1b4b] border-2 border-[#2e2b5b] shrink-0"></div>
                      <span className={`text-[11px] font-bold ${appTheme === 'midnight' ? 'text-zinc-100' : ''}`}>Midnight</span>
                    </button>
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
