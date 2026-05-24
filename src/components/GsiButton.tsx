import React from "react";

interface GsiButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

export const GsiButton: React.FC<GsiButtonProps> = ({ onClick, isLoading }) => {
  return (
    <button
      id="gsi-login-btn"
      onClick={onClick}
      disabled={isLoading}
      className="group relative inline-flex items-center justify-center gap-3 bg-zinc-50 text-zinc-950 px-7 py-3.5 font-sans font-semibold text-sm rounded-sm shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] hover:bg-zinc-100 transition-all active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer min-w-[240px]"
    >
      {/* Decorative side glyphs */}
      <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.3em] font-mono opacity-30">
        →
      </span>

      {isLoading ? (
        <span className="flex items-center gap-2.5">
          <svg
            className="animate-spin h-4 w-4 text-zinc-700"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span className="font-display italic text-zinc-700" style={{ fontWeight: 500 }}>Memverifikasi…</span>
        </span>
      ) : (
        <span className="flex items-center gap-3">
          <svg viewBox="0 0 48 48" className="w-[18px] h-[18px] block shrink-0">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>Masuk dengan Google</span>
        </span>
      )}
    </button>
  );
};
