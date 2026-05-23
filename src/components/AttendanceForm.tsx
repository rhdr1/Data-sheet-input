import React, { useState, useEffect, useMemo } from "react";
import { SheetAudit } from "../types";
import {
  UserCheck,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  User,
  PlusCircle,
  HelpCircle,
  Search,
  Users,
  BookOpen,
  Sparkles,
  Clock,
  Check,
  X,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronUp,
  Settings2,
  Lock,
  Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AttendanceFormProps {
  audits: Record<string, SheetAudit>;
  sheets: { title: string }[];
  onAppendMultipleRowsToSheet: (sheetTitle: string, rows: string[][]) => Promise<void>;
  isModifying: boolean;
  targetSheetName: string;
  userId?: string;
}

export const AttendanceForm: React.FC<AttendanceFormProps> = ({
  audits,
  sheets,
  onAppendMultipleRowsToSheet,
  isModifying,
  targetSheetName,
  userId,
}) => {
  // Target output sheet check using user custom target setting
  const targetSheetTitle = sheets.find(
    (s) => s.title.toLowerCase() === targetSheetName.toLowerCase()
  )?.title || targetSheetName;

  const hasTargetSheet = sheets.some((s) => s.title.toLowerCase() === targetSheetName.toLowerCase());
  const targetAudit = audits[targetSheetTitle];

  // List of source sheets containing student data (all sheets except target sheet)
  const studentSheets = sheets.filter((s) => s.title.toLowerCase() !== targetSheetName.toLowerCase());

  // State
  const [selectedSourceSheet, setSelectedSourceSheet] = useState("");
  const [isSourceLocked, setIsSourceLocked] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const d = new Date();
    // Offset local timezone
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split("T")[0];
  });
  
  // "Jam Pelajaran" (JP) written manually as number
  const [lessonPeriod, setLessonPeriod] = useState("1");

  // Student list search filter
  const [searchQuery, setSearchQuery] = useState("");

  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Helper to determine if a header is a standard field
  // "semua header selain timestemp dan nama nilainya ikut kehadiran kecuali jika di custom dan jp di tulis manual"
  const isStandardHeader = (header: string) => {
    const lower = header.toLowerCase();
    if (lower.includes("nama") || lower.includes("siswa") || lower.includes("murid") || lower.includes("peserta")) return true;
    if (lower === "jp" || lower.includes("jam") || lower.includes("pelajaran") || lower.includes("period") || lower.includes("lesson")) return true;
    if (lower.includes("tepat waktu")) return false; // Treat "tepat waktu" as rubric, not standard timestamp
    if (lower.includes("timestamp") || lower.includes("tanggal") || lower.includes("date") || lower.includes("waktu") || lower.includes("time") || lower.includes("hari")) return true;
    if (lower.includes("keterangan") || lower.includes("status") || lower.includes("asal")) return true;
    return false;
  };

  // Identify rubric columns (any column in gudang that is NOT a standard field)
  const rubricHeaders = useMemo(() => {
    if (!targetAudit || !targetAudit.headers) return [];
    return targetAudit.headers.filter(h => !isStandardHeader(h));
  }, [targetAudit]);

  // Individual student statuses
  const [attendanceRecords, setAttendanceRecords] = useState<
    Record<string, { status: string; points: number; rubrics: Record<string, number>; isEdited?: boolean }>
  >({});

  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (formSuccessMessage) {
      const timer = setTimeout(() => {
        setFormSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [formSuccessMessage]);

  // Auto-hide error message after 8 seconds
  useEffect(() => {
    if (formErrorMessage) {
      const timer = setTimeout(() => {
        setFormErrorMessage(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [formErrorMessage]);

  // Load preferences when userId or sheets change
  useEffect(() => {
    if (!userId || studentSheets.length === 0) return;
    
    try {
      const storedSheet = localStorage.getItem(`lockedSourceSheet_${userId}`);
      const storedLock = localStorage.getItem(`lockedSourceSheetActive_${userId}`);
      
      if (storedLock === 'true' && storedSheet && studentSheets.some(s => s.title === storedSheet)) {
        setIsSourceLocked(true);
        setSelectedSourceSheet(storedSheet);
      } else if (!selectedSourceSheet) {
        // Fallback to first available if not set
        setSelectedSourceSheet(studentSheets[0].title);
      }
    } catch {
      if (!selectedSourceSheet && studentSheets.length > 0) {
        setSelectedSourceSheet(studentSheets[0].title);
      }
    }
  }, [userId, studentSheets.length]);

  // Handle lock toggle
  const toggleSourceLock = () => {
    const newLockState = !isSourceLocked;
    setIsSourceLocked(newLockState);
    if (!userId) return;
    
    if (newLockState && selectedSourceSheet) {
      localStorage.setItem(`lockedSourceSheet_${userId}`, selectedSourceSheet);
      localStorage.setItem(`lockedSourceSheetActive_${userId}`, 'true');
    } else {
      localStorage.removeItem(`lockedSourceSheet_${userId}`);
      localStorage.removeItem(`lockedSourceSheetActive_${userId}`);
    }
  };

  // Extract student names from the selected source sheet
  const studentsInSelectedSheet = useMemo((): string[] => {
    if (!selectedSourceSheet) return [];
    
    const rawAudit = audits[selectedSourceSheet];
    if (!rawAudit || !rawAudit.headers) return [];

    const audit = rawAudit as SheetAudit;
    
    // Find column containing names
    const colIndex = audit.headers.findIndex((h) => {
      const lower = h.toLowerCase();
      return (
        lower.includes("nama") ||
        lower.includes("murid") ||
        lower.includes("siswa") ||
        lower.includes("student") ||
        lower.includes("peserta") ||
        lower.includes("lengkap")
      );
    });

    // Fallback to first column if no name columns found
    const targetColIdx = colIndex !== -1 ? colIndex : 0;
    const names = new Set<string>();

    audit.rows.forEach((row) => {
      const val = row[targetColIdx];
      if (val && val.trim() !== "" && val.trim() !== "NAMA") {
        names.add(val.trim());
      }
    });

    return Array.from(names);
  }, [audits, selectedSourceSheet]);

  // Handle generating default rubrics map based on current presence
  const generateRubricsMap = (value: number) => {
    const rubrics: Record<string, number> = {};
    rubricHeaders.forEach(header => {
      rubrics[header] = value;
    });
    return rubrics;
  };

  // Reset/Initialize attendance records when class sheet changes or loaded
  useEffect(() => {
    if (studentsInSelectedSheet.length > 0) {
      const initialRecords: Record<string, { status: string; points: number; rubrics: Record<string, number> }> = {};
      const jpNumber = parseInt(lessonPeriod, 10) || 0;
      studentsInSelectedSheet.forEach((student) => {
        initialRecords[student] = {
          status: "Hadir",
          points: jpNumber,
          rubrics: generateRubricsMap(jpNumber)
        };
      });
      setAttendanceRecords(initialRecords);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsInSelectedSheet, rubricHeaders]);

  // Update constraints when JP is changed globally
  useEffect(() => {
    const jpNumber = parseInt(lessonPeriod, 10) || 0;
    setAttendanceRecords((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(student => {
        const current = next[student];
        
        if (current.isEdited) {
          // Manually edited: only clamp values down to maximum JP
          let studentChanged = false;
          let newPoints = current.points;
          if (newPoints > jpNumber) {
            newPoints = jpNumber;
            studentChanged = true;
          }
  
          const newRubrics = { ...current.rubrics };
          Object.keys(newRubrics).forEach(k => {
            if (newRubrics[k] > newPoints) {
              newRubrics[k] = newPoints;
              studentChanged = true;
            }
          });
  
          if (studentChanged) {
            next[student] = { ...current, points: newPoints, rubrics: newRubrics };
            changed = true;
          }
        } else {
          // Not edited manually: automatically follow JP
          const pointValue = current.status === "Hadir" ? jpNumber : 0;
          const newRubrics = generateRubricsMap(pointValue);
          
          if (
            current.points !== pointValue || 
            Object.values(current.rubrics).some((v, i) => v !== Object.values(newRubrics)[i])
          ) {
            next[student] = { ...current, points: pointValue, rubrics: newRubrics };
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonPeriod]);

  // Action: Set status for a single student row
  const setStudentStatus = (student: string, status: string) => {
    setAttendanceRecords((prev) => {
      const jpNumber = parseInt(lessonPeriod, 10) || 0;
      const current = prev[student] || { status: "Hadir", points: jpNumber, rubrics: generateRubricsMap(jpNumber) };
      
      const pointValue = status === "Hadir" ? (current.isEdited ? current.points : jpNumber) : 0;
      const customRubrics = current.isEdited && status === "Hadir" ? current.rubrics : generateRubricsMap(pointValue);

      return {
        ...prev,
        [student]: {
          ...current,
          status,
          points: pointValue,
          rubrics: customRubrics,
          isEdited: current.isEdited
        },
      };
    });
  };

  // Action: Set custom custom Poin Hadir manually
  const setStudentPoints = (student: string, points: number) => {
    setAttendanceRecords((prev) => {
      const current = prev[student];
      if (!current) return prev;
      
      const jpNumber = parseInt(lessonPeriod, 10) || 0;
      let safePoints = points;
      if (safePoints > jpNumber) safePoints = jpNumber;
      if (safePoints < 0) safePoints = 0;

      const newRubrics = { ...current.rubrics };
      Object.keys(newRubrics).forEach(k => {
        if (newRubrics[k] > safePoints) newRubrics[k] = safePoints;
      });

      return {
        ...prev,
        [student]: {
          ...current,
          points: safePoints,
          rubrics: newRubrics,
          isEdited: true
        }
      };
    });
  };

  // Action: Set a specific rubric point for a student
  const setStudentRubric = (student: string, rubricHeader: string, value: number) => {
    setAttendanceRecords((prev) => {
      const current = prev[student];
      if (!current) return prev;
      
      let safeVal = value;
      if (safeVal > current.points) safeVal = current.points;
      if (safeVal < 0) safeVal = 0;
      
      return {
        ...prev,
        [student]: {
          ...current,
          rubrics: {
            ...current.rubrics,
            [rubricHeader]: safeVal
          },
          isEdited: true
        }
      };
    });
  };

  // Helper: Mark all students at once (Fast Entry!)
  const markAllStatus = (status: string) => {
    const updated = { ...attendanceRecords };
    const jpNumber = parseInt(lessonPeriod, 10) || 0;
    studentsInSelectedSheet.forEach((student) => {
      const pointValue = status === "Hadir" ? jpNumber : 0;
      updated[student] = {
        ...(updated[student] || {}),
        status,
        points: pointValue,
        rubrics: generateRubricsMap(pointValue),
        isEdited: false
      };
    });
    setAttendanceRecords(updated);
  };

  // Filtered list of students for search bar
  const filteredStudents = useMemo(() => {
    return studentsInSelectedSheet.filter((student) =>
      student.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [studentsInSelectedSheet, searchQuery]);

  // Handle mass submission
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccessMessage(null);
    setFormErrorMessage(null);

    if (!lessonPeriod.toString().trim()) {
      setFormErrorMessage("Silakan ketik atau pilih Jam Pelajaran terlebih dahulu.");
      return;
    }

    if (!hasTargetSheet) {
      setFormErrorMessage(
        `Kesalahan: Tab '${targetSheetName}' tidak ditemukan di database Google Spreadsheet ini. Tambahkan tab '${targetSheetName}' terlebih dahulu atau ubah pengaturan tujuan tab.`
      );
      return;
    }

    if (!targetAudit) {
      setFormErrorMessage(`Sedang menghubungkan ke struktur tab '${targetSheetName}'... Mohon tunggu.`);
      return;
    }

    const headers = targetAudit.headers;
    if (!headers || headers.length === 0) {
      setFormErrorMessage(
        `Gagal Mengirim: Tab '${targetSheetName}' kosong atau tidak mendeteksi baris Header. Harap pastikan baris pertama pada spreadsheet diisi judul kolom (seperti: Tanggal, Nama Siswa, JP, dsb).`
      );
      return;
    }

    if (studentsInSelectedSheet.length === 0) {
      setFormErrorMessage(
        `Gagal Mengirim: Tidak dapat mengurai data siswa dari sheet '${selectedSourceSheet}'. Pastikan sheet sumber tersebut memiliki kolom header yang mengandung kata "nama", "siswa", "murid", atau "peserta", dan memiliki data di bawahnya.`
      );
      return;
    }
    
    // Basic verification of target sheet columns
    const hasNameCol = headers.some(h => {
      const lower = h.toLowerCase();
      return lower.includes("nama") || lower.includes("siswa") || lower.includes("murid") || lower.includes("peserta");
    });
    
    if (!hasNameCol) {
      setFormErrorMessage(
        `Gagal Mengirim: Tab '${targetSheetName}' tidak valid karena kehilangan kolom identitas. Harap sisipkan setidaknya satu kolom bernama 'Nama Siswa' (atau murid/peserta) di baris pertama.`
      );
      return;
    }

    // Build values arrays for each student
    const rowsToAppend: string[][] = studentsInSelectedSheet.map((studentName) => {
      const jpNumber = parseInt(lessonPeriod, 10) || 0;
      const record = attendanceRecords[studentName] || {
        status: "Hadir",
        points: jpNumber,
        rubrics: generateRubricsMap(jpNumber)
      };

      // Fill values corresponding to index of headers dynamically
      const rowData = headers.map((header) => {
        if (isStandardHeader(header)) {
           const lower = header.toLowerCase();
           if (lower.includes("nama") || lower.includes("siswa") || lower.includes("murid") || lower.includes("peserta")) return studentName;
           if (lower.includes("timestamp") || lower.includes("tanggal") || lower.includes("date") || lower.includes("waktu") || lower.includes("time") || lower.includes("hari")) {
             if (lower.includes("timestamp")) {
               const d = new Date();
               return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
             }
             return attendanceDate;
           }
           if (lower === "jp" || lower.includes("jam") || lower.includes("pelajaran") || lower.includes("period") || lower.includes("lesson")) return lessonPeriod;
           if (lower.includes("keterangan") || lower.includes("status") || lower.includes("asal")) return record.status;
        }

        // Custom Rubric / Score Logic (for ALL other points)
        return (record.rubrics[header] ?? 0).toString();
      });

      // Automatically append status at the very end if there was no 'Keterangan' or 'Status' 'Asal' header
      const hasStatusHeader = headers.some(h => {
        const lower = h.toLowerCase();
        return lower.includes("keterangan") || lower.includes("status") || lower.includes("asal");
      });
      
      if (!hasStatusHeader) {
        rowData.push(record.status);
      }

      return rowData;
    });

    try {
      await onAppendMultipleRowsToSheet(targetSheetTitle, rowsToAppend);
      setFormSuccessMessage(
        `Sukses! Absensi kelas "${selectedSourceSheet}" (${studentsInSelectedSheet.length} siswa) untuk "${lessonPeriod}" berhasil disimpan ke tab "${targetSheetTitle}".`
      );
      
    } catch (err: any) {
      setFormErrorMessage(`Gagal menyimpan absensi massal: ${err?.message || err}`);
    }
  };

  // Counting summary of current selections
  const summaryCounters = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;

    studentsInSelectedSheet.forEach((student) => {
      const record = attendanceRecords[student];
      if (!record) return;
      if (record.status === "Hadir") hadir++;
      else if (record.status === "Izin") izin++;
      else if (record.status === "Sakit") sakit++;
      else if (record.status === "Alpa") alpa++;
    });

    return { hadir, izin, sakit, alpa };
  }, [attendanceRecords, studentsInSelectedSheet]);

  return (
    <div id="attendance-application-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* 2. Left Column: Config Panel */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Card 1: Pengaturan Global Sesi */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-850 p-5 shadow-xl space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Sesi & Tanggal</h4>
              <p className="text-[10px] text-zinc-500">Acuan utama sebelum absen diisi</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Input Tanggal */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                Tanggal Mengajar
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                </span>
                <input
                  id="global-attendance-date-input"
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100 transition-all font-medium font-mono cursor-pointer"
                />
              </div>
            </div>

            {/* Jam Pelajaran */}
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400 flex justify-between">
                <span>Jam Pelajaran (JP)</span>
                <span className="text-[9px] text-zinc-500 lowercase">contoh: 1</span>
              </label>
              <input
                id="custom-lesson-period"
                type="number"
                min="0"
                step="any"
                value={lessonPeriod}
                onChange={(e) => setLessonPeriod(e.target.value)}
                placeholder="Angka JP"
                className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600 transition-all font-medium font-mono"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Sumber Data Siswa (Database Worksheet Picker) */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-850 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Database Kelas Siswa</h4>
              <p className="text-[10px] text-zinc-500">Pilih tab spreadsheet asal murid</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                Pilih Kelas / Workbook
              </label>
              <div className="flex gap-2 items-center">
                <select
                  id="student-sheet-picker"
                  value={selectedSourceSheet}
                  onChange={(e) => {
                    setSelectedSourceSheet(e.target.value);
                    setSearchQuery("");
                  }}
                  disabled={isSourceLocked}
                  className="block w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100 transition-all font-bold disabled:opacity-50"
                >
                  {studentSheets.length === 0 ? (
                    <option value="">- Tidak ada tab siswa -</option>
                  ) : (
                    studentSheets.map((s) => (
                      <option key={s.title} value={s.title}>
                        Kelas: {s.title}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={toggleSourceLock}
                  className={`p-2 border rounded-xl flex shrink-0 items-center justify-center transition-colors ${
                    isSourceLocked 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                  title={isSourceLocked ? "Buka Kunci Kelas" : "Kunci Tab Kelas (Simpan sebagai default pada akun ini)"}
                >
                  {isSourceLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/40 p-3 rounded-xl border border-zinc-800 space-y-2 text-[11px] text-zinc-400 leading-normal">
              <div className="flex justify-between font-medium">
                <span>Terdeteksi di sub-sheet:</span>
                <span className="text-zinc-200 font-bold">{studentsInSelectedSheet.length} Siswa</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Nama siswa dibaca otomatis dari kolom berlabel "Nama", "Siswa", atau kolom pertama dari tab terpilih.
              </p>
            </div>
          </div>
        </div>
        
        {/* Card 3: Target Tab Gudang Info */}
        <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl text-xs space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
            <span className="font-bold text-zinc-300">Tujuan Penyimpanan</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            Data akan ditambahkan secara bulk (massal sekaligus) ke <strong className="text-emerald-400">"{targetSheetTitle}"</strong>.
            Terdeteksi {rubricHeaders.length} poin kustom (seperti {rubricHeaders.slice(0,2).join(", ")} {rubricHeaders.length > 2 && "dll"}).
          </p>
        </div>

      </div>

      {/* 3. Right Column: Student Grid & Fast Attendance */}
      <div className="lg:col-span-8 space-y-6">
        
        <div className="bg-zinc-900 rounded-2xl border border-zinc-850 p-6 shadow-xl flex flex-col justify-between min-h-[500px]">
          <div>
            {/* Header Form & Filter */}
            <div className="sm:flex items-center justify-between pb-5 border-b border-zinc-800 gap-4 mb-5">
              <div className="space-y-1 mb-3 sm:mb-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-black text-white text-base font-display uppercase tracking-tight">
                    Daftar Absensi Siswa
                  </h3>
                  <span className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[10px] px-2 py-0.5 rounded-lg font-extrabold">
                    {studentsInSelectedSheet.length} Orang
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Pilih status kehadiran di bawah. Klik tombol di kanan atas untuk mengisi cepat.
                </p>
              </div>

              {/* Fast Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => markAllStatus("Hadir")}
                  className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Hadir Semua
                </button>
                <button
                  type="button"
                  onClick={() => markAllStatus("Alpa")}
                  className="px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Alpa Semua
                </button>
              </div>
            </div>

            {/* Minimal Top-Center Notification Toast */}
            <AnimatePresence>
              {(formSuccessMessage || formErrorMessage) && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-md"
                >
                  {formSuccessMessage && (
                    <div className="px-4 py-3 bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-start gap-3 shadow-lg">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-relaxed break-words">{formSuccessMessage}</div>
                      <button onClick={() => setFormSuccessMessage(null)} className="opacity-70 hover:opacity-100 p-1 shrink-0 -mt-0.5 -mr-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {formErrorMessage && (
                    <div className="px-4 py-3 bg-rose-500 text-white rounded-xl text-xs font-medium flex items-start gap-3 shadow-lg">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="flex-1 leading-relaxed break-words">{formErrorMessage}</div>
                      <button onClick={() => setFormErrorMessage(null)} className="opacity-70 hover:opacity-100 p-1 shrink-0 -mt-0.5 -mr-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Stats Counters Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4 bg-zinc-950/30 p-2.5 rounded-xl border border-zinc-800 text-center">
              <div className="p-1 px-1.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                <span className="block text-[8px] sm:text-[9px] text-zinc-500 uppercase font-black tracking-wider">Hadir</span>
                <span className="text-sm font-black text-emerald-400 font-mono leading-none">{summaryCounters.hadir}</span>
              </div>
              <div className="p-1 px-1.5 rounded-lg bg-amber-950/20 border border-amber-900/30">
                <span className="block text-[8px] sm:text-[9px] text-zinc-500 uppercase font-black tracking-wider">Izin</span>
                <span className="text-sm font-black text-amber-400 font-mono leading-none">{summaryCounters.izin}</span>
              </div>
              <div className="p-1 px-1.5 rounded-lg bg-blue-950/20 border border-blue-900/30">
                <span className="block text-[8px] sm:text-[9px] text-zinc-500 uppercase font-black tracking-wider">Sakit</span>
                <span className="text-sm font-black text-blue-400 font-mono leading-none">{summaryCounters.sakit}</span>
              </div>
              <div className="p-1 px-1.5 rounded-lg bg-rose-950/20 border border-rose-900/30">
                <span className="block text-[8px] sm:text-[9px] text-zinc-500 uppercase font-black tracking-wider">Alpa</span>
                <span className="text-sm font-black text-rose-400 font-mono leading-none">{summaryCounters.alpa}</span>
              </div>
            </div>

            {/* Search Bar filter */}
            <div className="relative mb-4">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-zinc-500" />
              </span>
              <input
                type="text"
                placeholder="Cari nama murid..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-650 transition-all"
              />
            </div>

            {/* Roster student grid table list */}
            {studentsInSelectedSheet.length === 0 ? (
              <div className="bg-zinc-950/40 border border-zinc-850 p-12 text-center rounded-xl my-4 text-zinc-500 space-y-2">
                <Users className="w-8 h-8 mx-auto text-zinc-700" />
                <p className="text-xs font-semibold text-zinc-400">Belum ada kelas siswa yang dipilih</p>
                <p className="text-[10px] text-zinc-650">Silakan login, lalu pilih tab kelas di panel sebelah kiri.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="bg-zinc-950/40 border border-zinc-850 p-10 text-center rounded-xl my-4 text-zinc-500">
                <p className="text-xs">Siswa "{searchQuery}" tidak ditemukan.</p>
              </div>
            ) : (
              <div className="border border-zinc-850 rounded-xl overflow-hidden mb-4 bg-zinc-950/20">
                <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-850">
                  {filteredStudents.map((student, index) => {
                    const jpNumber = parseInt(lessonPeriod, 10) || 0;
                    const record = attendanceRecords[student] || {
                      status: "Hadir",
                      points: jpNumber,
                      notes: "",
                      rubrics: generateRubricsMap(jpNumber)
                    };
                    
                    const isExpanded = expandedStudent === student;

                    return (
                      <div key={student} className="divide-y divide-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/10 transition-all group">
                        <div className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          {/* Student Name and Count badge */}
                          <div className="flex items-center gap-2.5 min-w-[200px]">
                            <span className="font-mono text-[10px] text-zinc-600 font-bold w-5 shrink-0">
                              {(index + 1).toString().padStart(2, "0")}
                            </span>
                            <div className="truncate">
                              <span className="text-sm font-extrabold text-zinc-100 truncate block">
                                {student}
                              </span>
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                                <Award className="w-3 h-3 text-zinc-550 group-hover:text-emerald-500 transition-colors" />
                                <span>{record.status === "Hadir" ? `${record.points} Poin & ${(Object.values(record.rubrics) as number[]).reduce((a, b) => a + b, 0)} Poin Kustom` : "O Poin"}</span>
                              </span>
                            </div>
                          </div>

                          {/* Middle: Attendance Toggles (Must be at least 44px thick targets) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {[
                              { name: "Hadir", color: "hover:bg-emerald-500/15 border-emerald-950 text-emerald-400 active:border-emerald-500 bg-emerald-500/10" },
                              { name: "Izin", color: "hover:bg-amber-500/15 border-amber-950 text-amber-400 active:border-amber-500 bg-amber-500/10" },
                              { name: "Sakit", color: "hover:bg-blue-500/15 border-blue-950 text-blue-400 active:border-blue-500 bg-blue-500/10" },
                              { name: "Alpa", color: "hover:bg-rose-500/15 border-rose-950 text-rose-450 active:border-rose-500 bg-rose-500/10" }
                            ].map((item) => {
                              const isSelected = record.status === item.name;
                              let activeClass = "";

                              if (isSelected) {
                                if (item.name === "Hadir") activeClass = "bg-emerald-500 border-emerald-450 text-zinc-950 font-black shadow-lg shadow-emerald-950/20";
                                if (item.name === "Izin") activeClass = "bg-amber-500 border-amber-450 text-zinc-950 font-black shadow-lg shadow-amber-950/20";
                                if (item.name === "Sakit") activeClass = "bg-blue-500 border-blue-450 text-zinc-950 font-black shadow-lg shadow-blue-950/20";
                                if (item.name === "Alpa") activeClass = "bg-rose-500 border-rose-450 text-zinc-900 font-black shadow-lg shadow-rose-950/20";
                              } else {
                                activeClass = "bg-zinc-950/80 border-zinc-800 text-zinc-400";
                              }

                              return (
                                <button
                                  key={item.name}
                                  type="button"
                                  onClick={() => setStudentStatus(student, item.name)}
                                  className={`text-[11px] font-bold uppercase tracking-wider px-3.5 py-2.5 min-h-[40px] rounded-xl border transition-all cursor-pointer ${activeClass} ${!isSelected ? item.color : ""}`}
                                >
                                  {item.name}
                                </button>
                              );
                            })}
                          </div>

                          {/* Right: Custom Points Toggles */}
                          <div className="flex w-full md:w-auto shrink-0 justify-end mt-2 md:mt-0">
                            {rubricHeaders.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedStudent(isExpanded ? null : student)}
                                className={`px-4 py-2 rounded-lg border flex items-center justify-center shrink-0 transition-all font-bold text-[10px] uppercase tracking-wider gap-2 w-full md:w-auto ${
                                  isExpanded
                                    ? "bg-zinc-800 border-zinc-700 text-emerald-400 shadow-md"
                                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                                }`}
                                title="Kustomisasi Nilai Rubrik / 11 Poin Tambahan"
                              >
                                <span>Atur Rubrik Pribadi</span>
                                <Settings2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Custom Rubric Area */}
                        {rubricHeaders.length > 0 && (
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-zinc-950/60"
                              >
                                <div className="p-4 flex flex-col gap-4 border-t border-zinc-800/50">
                                  {/* Poin Hadir Configuration */}
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 w-32 shrink-0">
                                      Poin Hadir (Maks JP)
                                    </span>
                                    <input 
                                      type="number" 
                                      min="0" 
                                      max={jpNumber} 
                                      value={record.points} 
                                      onChange={(e) => setStudentPoints(student, parseInt(e.target.value) || 0)} 
                                      className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs w-16 text-center text-zinc-100 font-bold focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all" 
                                    />
                                    <span className="text-[9px] text-zinc-600 font-mono">Max: {jpNumber}</span>
                                  </div>
                                  
                                  {/* Rubrik Configuration */}
                                  <div className="space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 flex items-center gap-1.5 mb-2">
                                      <Sparkles className="w-3 h-3 text-emerald-500" />
                                      Poin Kustom ({rubricHeaders.length} Kriteria)
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {rubricHeaders.map(header => (
                                        <div key={header} className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800/80 rounded px-2 py-1.5 w-full md:w-auto md:min-w-[150px] shadow-sm">
                                          <span className="text-[9px] font-bold uppercase text-zinc-400 truncate w-24" title={header}>{header}</span>
                                          <input 
                                            type="number" 
                                            min="0" 
                                            max={record.points} 
                                            value={record.rubrics[header] ?? 0} 
                                            onChange={(e) => setStudentRubric(student, header, parseInt(e.target.value) || 0)} 
                                            className="bg-zinc-950 border border-zinc-700/50 rounded px-1.5 py-1 text-xs w-14 text-center text-emerald-400 font-bold focus:border-emerald-500 focus:outline-none transition-all focus:bg-zinc-900" 
                                          />
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-[9px] text-zinc-600 mt-1 font-mono">Poin kustom maksimal mengikuti Poin Hadir ({record.points}).</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Form Action Submit Button */}
          <div className="pt-4 border-t border-zinc-800 mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Ringkasan Kiriman:</span>
              <p className="text-xs font-bold text-zinc-300">
                Poin & Absensi untuk <strong className="text-white font-black">{filteredStudents.length}</strong> siswa siap diunggah sekaligus.
              </p>
            </div>
            <button
              id="submit-all-students-records-btn"
              type="button"
              onClick={handleBulkSubmit}
              disabled={isModifying || studentsInSelectedSheet.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-450 text-zinc-950 font-black text-xs uppercase tracking-wider px-6 py-4 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isModifying ? (
                <>
                  <RefreshCw className="w-4 h-4 text-zinc-950 animate-spin" />
                  <span>Sedang Mengirim Absensi Massal...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-zinc-950" />
                  <span>Kirim Absensi Satu Kelas ({studentsInSelectedSheet.length} Siswa)</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

