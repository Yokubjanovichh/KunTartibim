/**
 * Testlar: `npm test`
 * Vaqt zonasi telefon bilan bir xil boʻlishi shart — sana chegaralari shunga bogʻliq.
 * Modullar `require` bilan TZ va shim'lardan KEYIN yuklanadi (statik import
 * ulardan oldin bajarilardi). Baza testlari expo-sqlite oʻrniga Node SQLite'ni ishlatadi.
 */
process.env.TZ = 'Asia/Tashkent';
require('./shims/register.cjs');

require('./prayer-times.test');
require('./status.test');
require('./schedule.test');
require('./habits.test');
require('./db.test');
require('./alarm.test');

const { runAll } = require('./harness') as typeof import('./harness');
runAll();
