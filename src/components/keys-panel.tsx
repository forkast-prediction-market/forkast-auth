"use client";

import { CopyButton } from "@/components/copy-button";

interface KeysPanelProps {
  keys: string[];
  onRefresh: () => void;
  onRevoke: (key: string) => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  helper?: string | null;
}

export function KeysPanel({
  keys,
  onRefresh,
  onRevoke,
  loading = false,
  disabled = false,
  error,
  helper,
}: KeysPanelProps) {
  if (keys.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">My keys</h3>
          <p className="text-sm text-slate-300">
            Active Forkast API keys. Revoking disables access immediately for
            loaded credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || disabled}
          className={`
            rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold tracking-[0.28em] text-white
            uppercase transition
            hover:bg-white/20
            disabled:cursor-not-allowed disabled:opacity-50
          `}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <div className="space-y-3">
        {keys.map((key) => (
          <div
            key={key}
            className={`
              flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0e1a2b] p-4 text-sm text-white
              md:flex-row md:items-center md:justify-between
            `}
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-xs md:text-sm">
                {key}
              </span>
              <CopyButton value={key} size="sm" ariaLabel="Copy API key" />
            </div>
            <button
              type="button"
              onClick={() => onRevoke(key)}
              disabled={loading || disabled}
              className={`
                inline-flex items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 py-2
                text-xs font-semibold tracking-widest text-rose-100 uppercase transition
                hover:bg-rose-500/30
                disabled:cursor-not-allowed disabled:opacity-50
              `}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      {helper && !error && <p className="text-sm text-emerald-200">{helper}</p>}
      {error && <p className="text-sm text-rose-200">{error}</p>}
    </section>
  );
}
