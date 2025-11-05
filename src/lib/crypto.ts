const textEncoder = new TextEncoder();

function base64ToUint8Array(base64: string) {
  const normalized = base64.replace(/\s+/g, '');
  if (typeof atob === 'function') {
    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const buffer = Buffer.from(normalized, 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
}

function toBase64Url(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(view)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < view.length; i += 1) {
      binary += String.fromCharCode(view[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  throw new Error('No base64 encoder available in this environment.');
}

export async function hmacSha256Base64Url(secretBase64: string, message: string) {
  const secretBytes = base64ToUint8Array(secretBase64);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return toBase64Url(signature);
}
