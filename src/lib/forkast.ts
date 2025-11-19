import type { KeyBundle } from '@/types/keygen'

const FORKAST_DEBUG_ERRORS_ENABLED = (() => {
  const value = process.env.NEXT_PUBLIC_FORKAST_DEBUG_ERRORS
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
})()

export function getForkastBaseUrl() {
  return process.env.CLOB_URL!
}

interface CreateForkastKeyInput {
  address: string
  signature: string
  timestamp: string
  nonce: string
}

function sanitizeForkastMessage(status: number | undefined, rawMessage?: string) {
  const normalized = (rawMessage ?? '').replace(/\s+/g, ' ').trim()
  const truncated = normalized.slice(0, 200)

  let sanitized: string
  if (status === 401 || status === 403) {
    sanitized = 'Credentials rejected by Forkast. Generate a fresh API key and try again.'
  }
  else if (status === 429) {
    sanitized = 'Too many requests. Hold on a moment before retrying.'
  }
  else if (status === 500 || status === 503) {
    sanitized = 'Forkast is temporarily unavailable. Retry shortly.'
  }
  else if (truncated.length > 0) {
    sanitized = truncated
  }
  else {
    sanitized = 'Forkast request failed. Please try again.'
  }

  if (FORKAST_DEBUG_ERRORS_ENABLED && truncated.length > 0) {
    if (sanitized === truncated) {
      return truncated
    }
    return `${truncated} — ${sanitized}`
  }

  return sanitized
}

function normalizeKeyBundle(payload: unknown): Omit<KeyBundle, 'address'> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected response when minting API key.')
  }

  function unwrapNested(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if ('data' in record && typeof record.data === 'object') {
        return record.data as Record<string, unknown>
      }
      return record
    }
    return null
  }

  const record
    = unwrapNested(payload)
      ?? (() => {
        throw new Error('Unexpected response when minting API key.')
      })()

  function readFirst(...keys: string[]) {
    for (const key of keys) {
      const candidate = record[key]
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
    }
    return undefined
  }

  const apiKey = readFirst('apiKey', 'api_key', 'key', 'id')
  const apiSecret = readFirst(
    'apiSecret',
    'api_secret',
    'apiSecretBase64',
    'api_secret_base64',
    'secret',
    'secretKey',
    'secret_key',
  )
  const passphrase = readFirst(
    'passphrase',
    'api_passphrase',
    'passphraseHex',
    'passphrase_hex',
    'api_passphrase_hex',
  )

  if (!apiKey || !apiSecret || !passphrase) {
    const keys = Object.keys(record).join(', ') || 'none'
    throw new Error(`Forkast did not return API credentials. Payload keys: ${keys}`)
  }

  return {
    apiKey,
    apiSecret,
    passphrase,
  }
}

export async function createForkastKey({ address, signature, timestamp, nonce }: CreateForkastKeyInput) {
  const baseUrl = getForkastBaseUrl()
  const url = new URL('/auth/api-key', baseUrl)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      FORKAST_ADDRESS: address,
      FORKAST_SIGNATURE: signature,
      FORKAST_TIMESTAMP: timestamp,
      FORKAST_NONCE: nonce,
    },
  })

  if (!response.ok) {
    let message = 'Failed to generate API key.'
    try {
      const errorPayload = await response.json()
      if (errorPayload && typeof errorPayload === 'object') {
        message
          = (errorPayload as { message?: string }).message
            ?? (errorPayload as { error?: string }).error
            ?? message
      }
    }
    catch {
      // ignore parse failure
    }
    const sanitized = sanitizeForkastMessage(response.status, message)
    console.warn('[forkast] create key failed', {
      status: response.status,
      message,
    })
    throw new Error(sanitized)
  }

  const data = await response.json()
  return normalizeKeyBundle(data)
}
