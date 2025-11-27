import type { KeyBundle } from '@/types/keygen'
import { hmacSha256Base64Url } from '@/lib/crypto'

const FORKAST_DEBUG_ERRORS_ENABLED = (() => {
  const value = process.env.NEXT_PUBLIC_FORKAST_DEBUG_ERRORS
  if (!value) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return (
    normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on'
  )
})()

function getForkastBaseUrls() {
  const values = [process.env.CLOB_URL, process.env.RELAYER_URL]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))

  const unique = Array.from(new Set(values))
  if (unique.length === 0) {
    throw new Error('CLOB_URL or RELAYER_URL must be defined.')
  }
  return unique
}

export function getForkastBaseUrl() {
  return getForkastBaseUrls()[0]
}

interface CreateForkastKeyInput {
  address: string
  signature: string
  timestamp: string
  nonce: string
}

export interface ForkastAuthContext {
  address: string
  apiKey: string
  apiSecret: string
  passphrase: string
}

function sanitizeForkastMessage(
  status: number | undefined,
  rawMessage?: string,
) {
  const normalized = (rawMessage ?? '').replace(/\s+/g, ' ').trim()
  const truncated = normalized.slice(0, 200)

  let sanitized: string
  if (status === 401 || status === 403) {
    sanitized
      = 'Credentials rejected by Forkast. Generate a fresh API key and try again.'
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
    throw new Error(
      `Forkast did not return API credentials. Payload keys: ${keys}`,
    )
  }

  return {
    apiKey,
    apiSecret,
    passphrase,
  }
}

async function requestForkastKey(
  baseUrl: string,
  { address, signature, timestamp, nonce }: CreateForkastKeyInput,
) {
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
      baseUrl,
      status: response.status,
      message,
    })
    throw new Error(sanitized)
  }

  const data = await response.json()
  return normalizeKeyBundle(data)
}

export async function createForkastKey(input: CreateForkastKeyInput) {
  const targets = getForkastBaseUrls()
  let firstSuccess: Omit<KeyBundle, 'address'> | null = null
  let lastError: Error | null = null

  for (const baseUrl of targets) {
    try {
      const result = await requestForkastKey(baseUrl, input)
      if (!firstSuccess) {
        firstSuccess = result
      }
    }
    catch (error) {
      const normalized
        = error instanceof Error ? error : new Error(String(error))
      lastError = normalized
      // already logged inside requestForkastKey
    }
  }

  if (firstSuccess) {
    return firstSuccess
  }

  throw lastError ?? new Error('Failed to generate API key.')
}

function buildHeaders(options: {
  address: string
  apiKey: string
  passphrase: string
  timestamp: string
  signature: string
}) {
  return {
    FORKAST_ADDRESS: options.address,
    FORKAST_API_KEY: options.apiKey,
    FORKAST_PASSPHRASE: options.passphrase,
    FORKAST_TIMESTAMP: options.timestamp,
    FORKAST_SIGNATURE: options.signature,
  }
}

async function signMessage(options: {
  apiSecret: string
  method: string
  pathWithQuery: string
  timestamp: string
  body?: string
}) {
  const signingString = `${options.timestamp}${options.method.toUpperCase()}${options.pathWithQuery}${
    options.body ?? ''
  }`
  return hmacSha256Base64Url(options.apiSecret, signingString)
}

async function fetchKeysFrom(baseUrl: string, auth: ForkastAuthContext) {
  const path = '/auth/api-keys'
  const url = new URL(path, baseUrl)
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const signature = await signMessage({
    apiSecret: auth.apiSecret,
    method: 'GET',
    pathWithQuery: path,
    timestamp,
  })

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildHeaders({
      address: auth.address,
      apiKey: auth.apiKey,
      passphrase: auth.passphrase,
      timestamp,
      signature,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    let message = 'Failed to load keys.'
    try {
      const payload = await response.json()
      if (payload && typeof payload === 'object') {
        message
          = (payload as { message?: string }).message
            ?? (payload as { error?: string }).error
            ?? message
      }
    }
    catch {}
    const sanitized = sanitizeForkastMessage(response.status, message)
    throw new Error(`${baseUrl}: ${sanitized}`)
  }

  const data = await response.json()
  if (!Array.isArray(data)) {
    throw new TypeError(`${baseUrl}: Unexpected response when listing keys.`)
  }

  return data
    .map(value => (typeof value === 'string' ? value : null))
    .filter((value): value is string => Boolean(value))
}

export async function listForkastKeys(auth: ForkastAuthContext) {
  const targets = getForkastBaseUrls()
  const keys = new Set<string>()
  let lastError: Error | null = null

  for (const baseUrl of targets) {
    try {
      const fetched = await fetchKeysFrom(baseUrl, auth)
      fetched.forEach(key => keys.add(key))
    }
    catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn('[forkast] list keys failed', {
        baseUrl,
        message: lastError.message,
      })
    }
  }

  if (keys.size > 0) {
    return Array.from(keys)
  }

  throw lastError ?? new Error('Failed to load keys.')
}

async function revokeKeyOn(
  baseUrl: string,
  auth: ForkastAuthContext,
  apiKey: string,
) {
  const path = '/auth/api-key'
  const url = new URL(path, baseUrl)
  url.searchParams.set('apiKey', apiKey)
  const query = url.searchParams.toString()
  const pathWithQuery = query ? `${path}?${query}` : path
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const signature = await signMessage({
    apiSecret: auth.apiSecret,
    method: 'DELETE',
    pathWithQuery,
    timestamp,
  })

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: buildHeaders({
      address: auth.address,
      apiKey: auth.apiKey,
      passphrase: auth.passphrase,
      timestamp,
      signature,
    }),
  })

  if (!response.ok) {
    let message = 'Failed to revoke key.'
    try {
      const payload = await response.json()
      if (payload && typeof payload === 'object') {
        message
          = (payload as { message?: string }).message
            ?? (payload as { error?: string }).error
            ?? message
      }
    }
    catch {}
    const sanitized = sanitizeForkastMessage(response.status, message)
    throw new Error(`${baseUrl}: ${sanitized}`)
  }
}

export async function revokeForkastKey(
  auth: ForkastAuthContext,
  apiKey: string,
) {
  const targets = getForkastBaseUrls()
  let success = false
  let lastError: Error | null = null

  for (const baseUrl of targets) {
    try {
      await revokeKeyOn(baseUrl, auth, apiKey)
      success = true
    }
    catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn('[forkast] revoke key failed', {
        baseUrl,
        message: lastError.message,
      })
    }
  }

  if (success) {
    return true
  }

  throw lastError ?? new Error('Failed to revoke key.')
}
