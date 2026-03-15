import { test, expect, describe } from "bun:test";
import { $ } from "bun";

describe("CLI tests", () => {
  test("should render from stdin", async () => {
    const result =
      await $`echo "# Hello World" | bun src/cli.ts --theme none`.text();
    expect(result).toContain("Hello World");
  });

  test("should render an existing file", async () => {
    const result = await $`bun src/cli.ts spec.md --theme none`.text();
    expect(result.length).toBeGreaterThan(100);
  });

  test("CLI performance test", async () => {
    const largeMdPath = "large_temp.md";
    await $`bun -e 'require("fs").writeFileSync("${largeMdPath}", "# Performance\\n\\nSome **bold** text here.\\n".repeat(5000))'`;

    const start = performance.now();
    await $`bun src/cli.ts ${largeMdPath} --theme none`.text();
    const end = performance.now();

    const duration = end - start;
    console.log(`CLI Execution Time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500); // Process boot + execution should be under 500ms

    await $`rm ${largeMdPath}`;
  });
});
