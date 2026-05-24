import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-4">
            <span className="inline-block text-[10px] tracking-[0.45em] uppercase font-bold text-zinc-500">
              Galat Sistem
            </span>
          </div>
          <div className="relative bg-zinc-900/70 border border-zinc-800 rounded-sm p-8 sm:p-10">
            <div className="absolute inset-[6px] border pointer-events-none" style={{ borderColor: "var(--color-gold)", opacity: 0.18 }} />
            <div className="relative text-center">
              <p className="font-arabic text-3xl leading-tight mb-5" style={{ color: "var(--color-gold-pale)" }} dir="rtl">
                إِنَّا لِلّهِ
              </p>
              <h1 className="font-display text-2xl text-zinc-50 mb-3" style={{ fontWeight: 500 }}>
                Terjadi kesalahan
              </h1>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                Aplikasi mengalami galat yang tidak terduga. Mohon refresh halaman untuk memuat ulang.
              </p>
              {this.state.error?.message && (
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-sm p-3 mb-6 text-left">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 font-mono">Detail teknis</p>
                  <code className="text-[11px] text-rose-300 font-mono leading-relaxed break-words">
                    {this.state.error.message}
                  </code>
                </div>
              )}
              <button
                onClick={this.reset}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm text-xs font-bold tracking-[0.16em] uppercase transition-all text-zinc-950 cursor-pointer"
                style={{ background: "var(--color-gold)" }}
              >
                Muat Ulang
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
