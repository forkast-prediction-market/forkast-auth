export function shortenAddress(address?: string, chars = 4) {
  if (!address) return '';
  const prefixLength = Math.max(chars, 2);
  const suffixLength = Math.max(chars, 2);
  return `${address.slice(0, prefixLength + 2)}…${address.slice(-suffixLength)}`;
}

export function formatSecondsTimestamp(value: string) {
  if (!value) return '';
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return value;
  const date = new Date(asNumber * 1000);
  return date.toLocaleString();
}

