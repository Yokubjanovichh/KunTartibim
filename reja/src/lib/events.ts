/**
 * Maʼlumot oʻzgarganini ekranlarga bildirish.
 *
 * Har bir yozuvdan keyin `emitChange()` chaqiriladi; ekranlar `useDataVersion()`
 * orqali qayta oʻqiydi. Bitta hisoblagich — roʻyxatlar eskirib qolmasligining eng
 * sodda kafolati (MoliyamApp'da React Compiler aynan shu joyda adashtirgan edi).
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function emitChange(): void {
  version++;
  for (const l of listeners) l();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}
