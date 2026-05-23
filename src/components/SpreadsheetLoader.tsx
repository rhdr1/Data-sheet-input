import React, { useState } from "react";
import { parseSpreadsheetId } from "../lib/sheetsService";
import { Link2, RefreshCw, FileSpreadsheet, ExternalLink } from "lucide-react";
import { motion } from "motion/react";

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
    const defaultUrl = "https://docs.google.com/spreadsheets/d/1tDFYyLBJedRa02s5Nb4GAg1Ro22sp-LnmG3nxU2fFys/edit?gid=0#gid=0";
    setInputValue(defaultUrl);
    onLoadSpreadsheet(parseSpreadsheetId(defaultUrl));
  };

  return (
    <div id="spreadsheet-loader" className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
            Connected Document
          </span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-display">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />
            {spreadsheetTitle || "Loading Google Spreadsheet..."}
          </h2>
          {currentId && (
            <p className="text-xs font-mono text-zinc-500 mt-1 flex items-center gap-1">
              ID: {currentId}
            </p>
          )}
        </div>

        {currentId && (
          <a
            href={`https://docs.google.com/spreadsheets/d/${currentId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 rounded-xl border border-emerald-500/20 transition-all shadow-xs shrink-0"
          >
            <span>Open in Sheets</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="sheet-input" className="block text-[10px] uppercase font-bold tracking-widest text-zinc-400">
          Spreadsheet Link or ID
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link2 className="h-4 w-4 text-zinc-500" />
            </div>
            <input
              id="sheet-input"
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-zinc-100"
              placeholder="Paste Google Spreadsheet URL or Spreadsheet ID..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              id="load-sheet-btn"
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-zinc-950 font-extrabold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl hover:bg-emerald-400 active:scale-95 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                "Load Sheet"
              )}
            </button>
            <button
              id="demo-sheet-btn"
              type="button"
              onClick={setDemoSheet}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-zinc-700"
              title="Reset to User Default Spreadsheet"
            >
              Reset Default
            </button>
          </div>
        </div>
      </form>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-rose-950/40 border border-rose-900 text-rose-300 rounded-xl text-xs font-medium"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
};
