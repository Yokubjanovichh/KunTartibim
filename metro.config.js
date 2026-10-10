/**
 * Metro faqat shu ilovani (Namozim) koʻrsin: `reja/` — alohida ilova («Kun tartibim»),
 * oʻz node_modules bilan. Usiz Metro uning minglab fayllarini ham kezib chiqardi
 * (sekin, xotira koʻp ketadi) va ikki nusxa React Native aralashib ketishi mumkin edi.
 */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Windows'da ham, Unix'da ham: ajratuvchi — [\/] (teskari yoki oddiy chiziq)
const SEP = '[\\\\/]';
const rejaDir = path.resolve(__dirname, 'reja').split(/[\\/]/).map(escapeRegExp).join(SEP);

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${rejaDir}${SEP}`),
];

module.exports = config;
