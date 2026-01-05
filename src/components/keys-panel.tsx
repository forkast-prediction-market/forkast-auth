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
  activeKey?: string | null;
}

export function KeysPanel({
  keys,
  onRefresh,
  onRevoke,
  loading = false,
  disabled = false,
  error,
  helper,
  activeKey = null,
}: KeysPanelProps) {
  if (keys.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">My keys</h3>
          <p className="text-sm text-muted-foreground">
            Active Kuest API keys. Revoking disables access immediately for
            loaded credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || disabled}
          className={`
            rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold tracking-[0.2em]
            text-foreground uppercase transition
            hover:bg-muted/60
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
            disabled:cursor-not-allowed disabled:opacity-50
          `}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <div className="space-y-3">
        {keys.map((key) => {
          const isActive = activeKey === key;
          return (
            <div
              key={key}
              className={`
                flex flex-col gap-3 rounded-md border border-border bg-input/60 p-4 text-sm text-foreground
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
                disabled={loading || disabled || !isActive}
                title={
                  isActive
                    ? undefined
                    : "This API key was minted with a different nonce."
                }
                className={`
                  inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1 text-xs
                  font-semibold tracking-[0.2em] text-foreground uppercase transition
                  hover:bg-destructive/10 hover:text-destructive
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
                  disabled:cursor-not-allowed disabled:opacity-50
                `}
              >
                {isActive ? "Revoke" : "Different nonce"}
              </button>
            </div>
          );
        })}
      </div>

      {helper && !error && <p className="text-sm text-emerald-700">{helper}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
