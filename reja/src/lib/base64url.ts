/**
 * Matn ↔ base64url (UTF-8). Koʻchirish havolasi uchun: expo-router havola
 * parametrini uch marta "decode" qiladi (URLSearchParams → decodeURIComponent →
 * yana URLSearchParams), shuning uchun JSON ichidagi `&` `#` `+` buzilardi.
 * base64url'da faqat A–Z a–z 0–9 - _ — ular hech qaysi bosqichda oʻzgarmaydi.
 *
 * Sof JS: Hermes'dagi btoa/TextEncoder'ga tayanmaydi. Namozim'dagi
 * `src/lib/base64url.ts` bilan bir xil.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

function utf8Text(b: number[]): string {
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

export function encodeBase64Url(text: string): string {
  const b = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < b.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < b.length) out += ALPHABET[n & 63];
  }
  return out;
}

/** Notoʻgʻri belgi boʻlsa xato tashlaydi */
export function decodeBase64Url(s: string): string {
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('base64url emas');
    buf = ((buf << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return utf8Text(bytes);
}
