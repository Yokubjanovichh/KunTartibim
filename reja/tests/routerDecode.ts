/**
 * expo-router havola parametrini qanday oʻqishini takrorlaydi — telefonda nima
 * yetib kelishini testda koʻrish uchun (expo-router/build/fork/extractPathFromURL.js
 * va getStateFromPath-forks.js → parseQueryParams):
 *   1) URLSearchParams.entries()  — birinchi decode
 *   2) safeDecodeURIComponent(v)   — ikkinchi decode, yoʻlga qayta kodlanmay qoʻyiladi
 *   3) new URL(path, 'file:').searchParams — uchinchi decode (`+` → boʻsh joy, `&` va `#` boʻladi)
 */
export function routerDecode(url: string, param = 'd'): string | null {
  const res = new URL(url);
  const safe = (v: string) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const qs = [...res.searchParams.entries()].map(([k, v]) => `${k}=${safe(v)}`).join('&');
  const path = `${res.host}${res.pathname}${qs ? `?${qs}` : ''}`;
  return new URL(path, 'file:').searchParams.get(param);
}
