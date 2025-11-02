import { hmacSha256Hex } from '@/lib/crypto';
import type { KeyBundle } from '@/types/keygen';

const DEFAULT_FORKAST_BASE_URL = 'https://clob.forka.st';

export function getForkastBaseUrl() {
  return process.env.NEXT_PUBLIC_FORKAST_BASE_URL ?? DEFAULT_FORKAST_BASE_URL;
}

type CreateForkastKeyInput = {
  address: string;
  signature: string;
  timestamp: string;
  nonce: string;
};

type ForkastAuthContext = {
  address: string;
  apiKey: string;
  apiSecret: string;
  passphrase: string;
};

function normalizeKeyBundle(payload: unknown): KeyBundle {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected response when minting API key.');
  }

  const maybeRecord = payload as Record<string, unknown>;
  const apiKey =
    (maybeRecord.apiKey as string | undefined) ??
    (maybeRecord.api_key as string | undefined);
  const apiSecret =
    (maybeRecord.apiSecret as string | undefined) ??
    (maybeRecord.api_secret as string | undefined);
  const passphrase =
    (maybeRecord.passphrase as string | undefined) ??
    (maybeRecord.api_passphrase as string | undefined);

  if (!apiKey || !apiSecret || !passphrase) {
    throw new Error('Forkast did not return API credentials.');
  }

  return {
    apiKey,
    apiSecret,
    passphrase,
  };
}

export async function createForkastKey({
  address,
  signature,
  timestamp,
  nonce,
}: CreateForkastKeyInput) {
  const baseUrl = getForkastBaseUrl();
  const url = new URL('/auth/api-key', baseUrl);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      FORKAST_ADDRESS: address,
      FORKAST_SIGNATURE: signature,
      FORKAST_TIMESTAMP: timestamp,
      FORKAST_NONCE: nonce,
    },
  });

  if (!response.ok) {
    let message = 'Failed to generate API key.';
    try {
      const errorPayload = await response.json();
      if (errorPayload && typeof errorPayload === 'object') {
        message =
          (errorPayload as { message?: string }).message ??
          (errorPayload as { error?: string }).error ??
          message;
      }
    } catch {
      // ignore parse failure
    }
    const enhancedMessage = response.status
      ? `${message} (HTTP ${response.status})`
      : message;
    throw new Error(enhancedMessage);
  }

  const data = await response.json();
  return normalizeKeyBundle(data);
}

function buildHeaders({
  address,
  apiKey,
  passphrase,
  timestamp,
  signature,
}: {
  address: string;
  apiKey: string;
  passphrase: string;
  timestamp: string;
  signature: string;
}) {
  return {
    FORKAST_ADDRESS: address,
    FORKAST_API_KEY: apiKey,
    FORKAST_PASSPHRASE: passphrase,
    FORKAST_TIMESTAMP: timestamp,
    FORKAST_SIGNATURE: signature,
  };
}

async function signMessage({
  apiSecret,
  method,
  pathWithQuery,
  timestamp,
  body,
}: {
  apiSecret: string;
  method: string;
  pathWithQuery: string;
  timestamp: string;
  body?: string;
}) {
  const signingString = `${timestamp}${method.toUpperCase()}${pathWithQuery}${
    body ?? ''
  }`;
  return hmacSha256Hex(apiSecret, signingString);
}

export async function listForkastKeys(auth: ForkastAuthContext) {
  const baseUrl = getForkastBaseUrl();
  const path = '/auth/api-keys';
  const url = new URL(path, baseUrl);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = await signMessage({
    apiSecret: auth.apiSecret,
    method: 'GET',
    pathWithQuery: path,
    timestamp,
  });

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
  });

  if (!response.ok) {
    let message = 'Failed to load keys.';
    try {
      const payload = await response.json();
      if (payload && typeof payload === 'object') {
        message =
          (payload as { message?: string }).message ??
          (payload as { error?: string }).error ??
          message;
      }
    } catch {
      // ignore parse error
    }
    const enhancedMessage = response.status
      ? `${message} (HTTP ${response.status})`
      : message;
    throw new Error(enhancedMessage);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response when listing keys.');
  }

  return data
    .map((value) => (typeof value === 'string' ? value : null))
    .filter((value): value is string => Boolean(value));
}

export async function revokeForkastKey(auth: ForkastAuthContext, apiKey: string) {
  const baseUrl = getForkastBaseUrl();
  const path = '/auth/api-key';
  const url = new URL(path, baseUrl);
  url.searchParams.set('apiKey', apiKey);

  const pathWithQuery = `${path}?${url.searchParams.toString()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = await signMessage({
    apiSecret: auth.apiSecret,
    method: 'DELETE',
    pathWithQuery,
    timestamp,
  });

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: buildHeaders({
      address: auth.address,
      apiKey: auth.apiKey,
      passphrase: auth.passphrase,
      timestamp,
      signature,
    }),
  });

  if (!response.ok) {
    let message = 'Failed to revoke key.';
    try {
      const payload = await response.json();
      if (payload && typeof payload === 'object') {
        message =
          (payload as { message?: string }).message ??
          (payload as { error?: string }).error ??
          message;
      }
    } catch {
      // ignore
    }
    const enhancedMessage = response.status
      ? `${message} (HTTP ${response.status})`
      : message;
    throw new Error(enhancedMessage);
  }

  const payload = await response.json().catch(() => ({}));
  const revoked =
    typeof payload === 'object' && payload !== null
      ? (payload as { revoked?: boolean }).revoked
      : undefined;

  return Boolean(revoked);
}

