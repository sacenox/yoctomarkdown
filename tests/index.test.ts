import { test, expect, describe } from "bun:test";
import { highlightSync, createHighlighter } from "../src/index";

describe("Programmatic Usage: highlightSync", () => {
  test("should format basic markdown elements", () => {
    const res = highlightSync("# Heading\n\n**bold** and *italic*", {
      theme: "none",
    });
    expect(res).toContain("Heading");
    expect(res).toContain("bold");
    expect(res).toContain("italic");
  });

  test("should format lists", () => {
    const res = highlightSync("- Item 1\n- Item 2\n1. Number 1", {
      theme: "none",
    });
    expect(res).toContain("Item 1");
    expect(res).toContain("Item 2");
    expect(res).toContain("Number 1");
  });

  test("performance test on large input", () => {
    const largeMd = "# Heading\n\nSome **bold** text here.\n".repeat(5000);
    const start = performance.now();
    highlightSync(largeMd, { theme: "none" });
    const end = performance.now();

    const duration = end - start;
    console.log(`Programmatic Parse Time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(200); // 5000 lines should be fast
  });
});

function expectStreamMatch(res: string, markdown: string) {
  const expected = highlightSync(markdown, { theme: "none" });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: clear line ansi escape
  expect(res.replace(/[^\n]*\x1b\[2K\r/g, "")).toBe(expected);
}

describe("Programmatic Usage: createHighlighter (Streaming)", () => {
  test("should handle chunks without breaking output", () => {
    const highlighter = createHighlighter({ theme: "none" });
    let res = highlighter.write("# Hea");
    res += highlighter.write("ding\n");
    res += highlighter.write("\nSome **tex");
    res += highlighter.write("t**\n");
    res += highlighter.end();

    expect(res).toContain("Heading");
    expect(res).toContain("Some **text**");
  });

  test("should handle character by character streaming", () => {
    const markdown =
      "# Title\n\nThis is a **test** of *character* streaming.\n\n- item 1\n- item 2\n";
    const highlighter = createHighlighter({ theme: "none" });
    let res = "";
    for (const char of markdown) {
      res += highlighter.write(char);
    }
    res += highlighter.end();

    expectStreamMatch(res, markdown);
  });

  test("should handle random chunk sizes", () => {
    const markdown =
      "```javascript\nconst x = 1;\n```\n\n# Heading 2\n\nSome text with `code`.\n> Blockquote here\n\n1. One\n2. Two\n";
    const highlighter = createHighlighter({ theme: "none" });
    let res = "";

    // Split into random chunks
    let i = 0;
    while (i < markdown.length) {
      const chunkSize = Math.floor(Math.random() * 10) + 1;
      res += highlighter.write(markdown.slice(i, i + chunkSize));
      i += chunkSize;
    }
    res += highlighter.end();

    expectStreamMatch(res, markdown);
  });

  test("should clear multiple lines when wrapped", () => {
    // Mock columns
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 10,
      configurable: true,
    });

    const highlighter = createHighlighter({ theme: "none" });
    // 25 chars, columns = 10, so it takes 3 visual lines
    const chunk1 = "1234567890123456789012345";
    const chunk2 = "67890\n";

    let res = highlighter.write(chunk1);
    res += highlighter.write(chunk2);
    res += highlighter.end();

    // The first chunk is written, then cleared. Since it takes 3 lines,
    // clear sequence should have \x1b[1A\x1b[2K repeated twice.
    expect(res).toContain("\x1b[1A\x1b[2K\x1b[1A\x1b[2K");

    // Restore
    if (originalColumns !== undefined) {
      Object.defineProperty(process.stdout, "columns", {
        value: originalColumns,
        configurable: true,
      });
    }
  });
});
