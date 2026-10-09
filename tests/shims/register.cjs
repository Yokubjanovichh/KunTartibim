/**
 * `expo-sqlite` importini testlarda Node SQLite shim'iga yoʻnaltiradi.
 * tsx .ts fayllarni CommonJS sifatida yuklaydi, shuning uchun require hal qilish
 * nuqtasini almashtirish yetarli.
 */
const Module = require('node:module');
const path = require('node:path');

const SHIMS = { 'expo-sqlite': path.join(__dirname, 'expo-sqlite.cjs') };

const original = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(SHIMS, request)) return SHIMS[request];
  return original.call(this, request, ...rest);
};

// node:sqlite hali "experimental" — ogohlantirish test chiqishini ifloslamasin
const emit = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  if (String(warning).includes('SQLite')) return;
  return emit.call(this, warning, ...rest);
};
