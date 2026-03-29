import { Component, ReactNode, ErrorInfo } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="text-center space-y-6 max-w-md">
            {/* Speedo Bill Logo */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Speedo Bill hit a bump
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Something unexpected happened. Your data is safe — just restart the app to get back on track.
            </p>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-xs text-slate-500 font-mono text-left max-h-24 overflow-auto">
              {this.state.error?.message || "Unknown error"}
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all active:scale-[0.97]"
              >
                Restart App
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                }}
                className="w-full px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-700 hover:bg-slate-700 transition-all active:scale-[0.97]"
              >
                Try to Recover
              </button>
            </div>
            <p className="text-[11px] text-slate-600">Speedo Bill v8.0.0 • © 2026 Mangal Multiproduct</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
