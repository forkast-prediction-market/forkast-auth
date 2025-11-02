'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type CopyButtonProps = {
  value: string;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
};

export function CopyButton({
  value,
  size = 'md',
  className = '',
  ariaLabel = 'Copy to clipboard',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy failed', error);
    }
  };

  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 ${className}`}
      aria-label={ariaLabel}
    >
      {copied ? <Check size={iconSize} strokeWidth={2.5} /> : <Copy size={iconSize} />}
    </button>
  );
}

