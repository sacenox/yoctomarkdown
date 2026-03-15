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

function renderTerminalOutput(
  output: string,
  columns = Number.POSITIVE_INFINITY,
) {
  const screen: string[][] = [[]];
  let row = 0;
  let column = 0;
  let savedCursor: { row: number; column: number } | null = null;

  function ensureRow(targetRow: number) {
    while (screen.length <= targetRow) {
      screen.push([]);
    }
  }

  function writeChar(char: string) {
    if (column >= columns) {
      row += 1;
      column = 0;
    }

    ensureRow(row);
    if (!screen[row]) {
      screen[row] = [];
    }
    const currentLine = screen[row];
    if (!currentLine) {
      return;
    }
    currentLine[column] = char;
    column += 1;
  }

  for (let i = 0; i < output.length; i += 1) {
    const rest = output.slice(i);

    if (rest.startsWith("\x1b7")) {
      savedCursor = { row, column };
      i += 1;
      continue;
    }

    if (rest.startsWith("\x1b8")) {
      if (savedCursor) {
        row = savedCursor.row;
        column = savedCursor.column;
      }
      i += 1;
      continue;
    }

    if (rest.startsWith("\x1b[J")) {
      ensureRow(row);
      screen[row] = (screen[row] ?? []).slice(0, column);
      for (let clearRow = row + 1; clearRow < screen.length; clearRow += 1) {
        screen[clearRow] = [];
      }
      i += 2;
      continue;
    }

    if (rest.startsWith("\x1b[2K")) {
      ensureRow(row);
      screen[row] = [];
      i += 3;
      continue;
    }

    if (rest.startsWith("\x1b[1A")) {
      row = Math.max(0, row - 1);
      i += 3;
      continue;
    }

    const char = output[i];
    if (char === "\n") {
      row += 1;
      column = 0;
      ensureRow(row);
      continue;
    }

    if (char === "\r") {
      column = 0;
      continue;
    }

    if (char !== undefined && char !== "\x1b") {
      writeChar(char);
    }
  }

  return screen
    .map((line) => line.join("").replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n+$/u, "");
}

function expectStreamMatch(res: string, markdown: string) {
  const expected = highlightSync(markdown, { theme: "none" });
  expect(renderTerminalOutput(res)).toBe(renderTerminalOutput(expected));
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

  test("should redraw wrapped partial lines after an external prefix", () => {
    const prefix = "◆ ";
    const markdown =
      "No `\\x1b[2K` or `\\r` sequences in the streamed text. The ANSI colour codes remain (intentional — those are static style codes from yoctocolors, not cursor-control sequences).\n";
    const splitAt = 134;

    const highlighter = createHighlighter({ theme: "none" });
    let res = prefix;
    res += highlighter.write(markdown.slice(0, splitAt));
    res += highlighter.write(markdown.slice(splitAt));
    res += highlighter.end();

    expect(renderTerminalOutput(res, 120)).toBe(
      renderTerminalOutput(`${prefix}${markdown}`, 120),
    );
  });
});
