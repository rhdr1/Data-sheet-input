import React, { useState } from "react";
import { parseSpreadsheetId } from "../lib/sheetsService";
import { Link2, RefreshCw, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { APP_CONFIG } from "../config";

interface SpreadsheetLoaderProps {
  currentId: string;
  spreadsheetTitle: string;
  onLoadSpreadsheet: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const SpreadsheetLoader: React.FC<SpreadsheetLoaderProps> = ({
  currentId,
  spreadsheetTitle,
  onLoadSpreadsheet,
  isLoading,
  error,
}) => {
  const [inputValue, setInputValue] = useState(
    currentId ? `https://docs.google.com/spreadsheets/d/${currentId}` : ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = parseSpreadsheetId(inputValue);
    if (!cleanId) return;
    onLoadSpreadsheet(cleanId);
  };

  const setDemoSheet = () => {
    const defaultUrl = `https://docs.google.com/spreadsheets/d/${APP_CONFIG.defaultSpreadsheetId}/edit?gid=0#gid=0`;
    setInputValue(defaultUrl);
    onLoadSpreadsheet(parseSpreadsheetId(defaultUrl));
  };

  return (
    <div id="spreadsheet-loader" className="relative bg-zinc-950/60 border border-zinc-800 rounded-sm p-6">
      {/* Gold corner accents */}
      <div aria-hidden className="absolute inset-2 border pointer-events-none" style={{
        borderColor: "var(--color-gold)", opacity: 0.12,
      }} />

      <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] tracking-[0.32em] uppercase font-bold mb-2"
            style={{ color: "var(--color-gold)" }}>
            Dokumen Terhubung
          </span>
          <h2 className="font-display text-xl sm:text-2xl text-zinc-100 leading-tight tracking-tight truncate" style={{ fontWeight: 500 }}>
            {spreadsheetTitle || (
              <span className="italic text-zinc-500" style={{ fontWeight: 300 }}>Memuat dokumen…</span>
            )}
          </h2>
          {currentId && (
            <p className="text-[10px] font-mono text-zinc-500 mt-1.5 truncate">
              <span className="text-zinc-600">id ·</span> {currentId}
            </p>
          )}
        </div>

        {currentId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${currentId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 hover:text-zinc-50 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-sm transition-all shrink-0 font-sans"
          >
            <span>Buka di Sheets</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 relative">
        <label
          htmlFor="sheet-input"
          className="block text-[9px] uppercase font-bold tracking-[0.32em] text-zinc-500"
        >
          Link atau ID Spreadsheet
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link2 className="h-3.5 w-3.5 text-zinc-600" />
            </div>
            <input
              id="sheet-input"
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-sm text-xs font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-all text-zinc-100"
              placeholder="docs.google.com/spreadsheets/d/…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              id="load-sheet-btn"
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm text-xs font-bold tracking-[0.16em] uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950"
              style={{ background: "var(--color-gold)" }}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Muat"
              )}
            </button>
            <button
              id="demo-sheet-btn"
              type="button"
              onClick={setDemoSheet}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-sm text-[11px] font-semibold transition-all cursor-pointer border border-zinc-800 hover:border-zinc-700"
              title="Reset ke spreadsheet default"
            >
              Default
            </button>
          </div>
        </div>
      </form>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-rose-950/40 border border-rose-900/60 text-rose-300 rounded-sm text-xs font-medium leading-relaxed"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
};
