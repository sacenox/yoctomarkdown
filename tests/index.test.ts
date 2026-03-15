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
});
