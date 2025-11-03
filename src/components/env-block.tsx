'use client';

import { useMemo } from 'react';

import { CopyButton } from '@/components/copy-button';
import type { KeyBundle } from '@/types/keygen';

type EnvBlockProps = {
  bundle: KeyBundle | null;
};

export function EnvBlock({ bundle }: EnvBlockProps) {
  const envLines = useMemo(() => {
    if (!bundle) return '';
    return [
      `FORKAST_ADDRESS=${bundle.address}`,
      `FORKAST_API_KEY=${bundle.apiKey}`,
      `FORKAST_API_SECRET=${bundle.apiSecret}`,
      `FORKAST_PASSPHRASE=${bundle.passphrase}`,
    ].join('\n');
  }, [bundle]);

  if (!bundle) {
    return null;
  }

  const inputs = [
    {
      label: 'FORKAST_ADDRESS',
      value: bundle.address,
    },
    {
      label: 'FORKAST_API_KEY',
      value: bundle.apiKey,
    },
    {
      label: 'FORKAST_API_SECRET',
      value: bundle.apiSecret,
    },
    {
      label: 'FORKAST_PASSPHRASE',
      value: bundle.passphrase,
    },
  ];

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header>
        <h3 className="text-lg font-semibold text-white">Your credentials</h3>
        <p className="mt-1 text-sm text-slate-300">
          Copy and keep these in a safe place. Treat them like production secrets.
        </p>
      </header>
      <div className="space-y-3">
        {inputs.map((input) => (
          <label key={input.label} className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {input.label}
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0e1a2b] px-3 py-2">
              <input
                value={input.value}
                readOnly
                className="flex-1 truncate bg-transparent font-mono text-sm text-white outline-none"
              />
              <CopyButton
                value={input.value}
                size="sm"
                ariaLabel={`Copy ${input.label}`}
              />
            </div>
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            .env block
          </span>
          <CopyButton value={envLines} ariaLabel="Copy env block" />
        </div>
        <textarea
          value={envLines}
          readOnly
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-[#0a1627] p-3 font-mono text-xs leading-relaxed text-white outline-none"
        />
      </div>
    </section>
  );
}
