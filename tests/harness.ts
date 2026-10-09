/** Minimal test yuritgich — alohida freymvork kerak emas */

type TestFn = () => void | Promise<void>;
const tests: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export async function runAll(): Promise<void> {
  let passed = 0;
  const failed: string[] = [];
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed.push(t.name);
      console.log(`  ✗ ${t.name}\n    ${e instanceof Error ? e.message.split('\n').join('\n    ') : String(e)}`);
    }
  }
  console.log(`\n${passed}/${tests.length} oʻtdi`);
  if (failed.length) {
    console.log(`Yiqilgan: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}
