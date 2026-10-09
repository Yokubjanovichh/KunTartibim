/**
 * Testlar: `npm test`
 * Vaqt zonasi telefon bilan bir xil boʻlishi shart — sana chegaralari shunga bogʻliq.
 * Test fayllari dinamik yuklanadi: statik import TZ oʻrnatilishidan oldin bajarilardi.
 */
process.env.TZ = 'Asia/Tashkent';

async function main() {
  await import('./prayer-times.test');
  await import('./status.test');
  await import('./schedule.test');
  const { runAll } = await import('./harness');
  await runAll();
}

main();
