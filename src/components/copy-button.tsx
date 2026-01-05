'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'

interface CopyButtonProps {
  value: string
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

export function CopyButton({ value, size = 'md', className = '', ariaLabel = 'Copy to clipboard' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
    catch (error) {
      console.error('Copy failed', error)
    }
  }

  const iconSize = size === 'sm' ? 16 : 18

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`
        inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-foreground
        transition
        hover:bg-muted/60
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
        ${className}
      `}
      aria-label={ariaLabel}
    >
      {copied ? <CheckIcon size={iconSize} strokeWidth={2.5} /> : <CopyIcon size={iconSize} />}
    </button>
  )
}
