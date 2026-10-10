/**
 * Testlar: `npm test`
 * Vaqt zonasi telefon bilan bir xil boʻlishi shart — sana chegaralari shunga bogʻliq.
 * Modullar `require` bilan TZ va shim'lardan KEYIN yuklanadi (statik import
 * ulardan oldin bajarilardi). Baza testlari expo-sqlite oʻrniga Node SQLite'ni ishlatadi.
 */
process.env.TZ = 'Asia/Tashkent';
require('./shims/register.cjs');

require('./habits.test');
require('./schedule.test');
require('./db.test');
require('./transfer.test');

const { runAll } = require('./harness') as typeof import('./harness');
runAll();
