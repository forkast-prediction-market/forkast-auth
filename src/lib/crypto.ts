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

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacSha256Hex(secretBase64: string, message: string) {
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
  return `0x${toHex(signature)}`;
}

