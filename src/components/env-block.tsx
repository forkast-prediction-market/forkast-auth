'use client'

import type { KeyBundle } from '@/types/keygen'

import { useMemo } from 'react'
import { CopyButton } from '@/components/copy-button'

interface EnvBlockProps {
  bundle: KeyBundle | null
}

export function EnvBlock({ bundle }: EnvBlockProps) {
  const envLines = useMemo(() => {
    if (!bundle) {
      return ''
    }

    return [
      `KUEST_ADDRESS=${bundle.address}`,
      `KUEST_API_KEY=${bundle.apiKey}`,
      `KUEST_API_SECRET=${bundle.apiSecret}`,
      `KUEST_PASSPHRASE=${bundle.passphrase}`,
    ].join('\n')
  }, [bundle])

  if (!bundle) {
    return null
  }

  const inputs = [
    {
      label: 'KUEST_ADDRESS',
      value: bundle.address,
    },
    {
      label: 'KUEST_API_KEY',
      value: bundle.apiKey,
    },
    {
      label: 'KUEST_API_SECRET',
      value: bundle.apiSecret,
    },
    {
      label: 'KUEST_PASSPHRASE',
      value: bundle.passphrase,
    },
  ]

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card/80 p-6 shadow-sm">
      <header>
        <h3 className="text-lg font-semibold text-foreground">Your credentials</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy and keep these in a safe place. Treat them like production secrets.
        </p>
      </header>
      <div className="space-y-3">
        {inputs.map(input => (
          <label key={input.label} className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
              {input.label}
            </span>
            <div className="flex items-center gap-2 rounded-md border border-border bg-input px-3 py-2">
              <input
                value={input.value}
                readOnly
                className="flex-1 truncate bg-transparent font-mono text-sm text-foreground outline-none"
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
          <span className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            .env block
          </span>
          <CopyButton value={envLines} ariaLabel="Copy env block" />
        </div>
        <textarea
          value={envLines}
          readOnly
          rows={4}
          className={`
            w-full resize-none rounded-md border border-border bg-input p-3 font-mono text-xs leading-relaxed
            text-foreground outline-none
          `}
        />
      </div>
    </section>
  )
}
