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

    // Parse CSI sequences: \x1b[ <params> <letter>
    if (rest.startsWith("\x1b[")) {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape regex
      const csiMatch = rest.match(/^\x1b\[([0-9;]*)([A-Za-z])/);
      if (csiMatch) {
        const param = csiMatch[1] ?? "";
        const code = csiMatch[2] ?? "";
        const n = param === "" ? 1 : parseInt(param, 10);
        i += csiMatch[0].length - 1; // -1 because loop does i++

        switch (code) {
          case "A": // Cursor Up
            row = Math.max(0, row - n);
            break;
          case "D": // Cursor Backward
            column = Math.max(0, column - n);
            break;
          case "J": // Erase in Display (from cursor down)
            ensureRow(row);
            screen[row] = (screen[row] ?? []).slice(0, column);
            for (
              let clearRow = row + 1;
              clearRow < screen.length;
              clearRow += 1
            ) {
              screen[clearRow] = [];
            }
            break;
          case "K": {
            // Erase in Line
            const mode = param === "" ? 0 : n;
            ensureRow(row);
            if (mode === 0) {
              // erase to end of line
              screen[row] = (screen[row] ?? []).slice(0, column);
            } else if (mode === 2) {
              // erase whole line
              screen[row] = [];
            }
            break;
          }
          case "C": // Cursor Forward
            column += n;
            break;
          case "G": // Cursor Horizontal Absolute (1-based)
            column = (param === "" ? 1 : n) - 1;
            break;
          default:
            break;
        }
        continue;
      }
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

  test("should preserve text before streamed output (inline use)", () => {
    // When a highlighter is used inline (e.g. "AI: " prefix already on
    // the terminal line), the erase/redraw must not destroy the prefix.
    const markdown = "Hello **world**";
    const highlighter = createHighlighter({ theme: "none" });
    let res = "AI: "; // simulates text already on terminal line
    for (const ch of markdown) {
      res += highlighter.write(ch);
    }
    res += highlighter.end();

    expect(renderTerminalOutput(res)).toBe("AI: Hello **world**");
  });

  test("should erase and redraw partial lines that wrap in terminal", () => {
    // erasePreviousPartial uses cursor-back + \x1b[0J (erase from cursor
    // to end of screen). This preserves any text before our output on the
    // same terminal line and is scroll-safe (all relative).
    const markdown =
      "No `\\x1b[2K` or `\\r` sequences in the streamed text. The ANSI colour codes remain (intentional — those are static style codes from yoctocolors, not cursor-control sequences).\n";
    const splitAt = 134;

    const highlighter = createHighlighter({ theme: "none" });
    let res = "";
    res += highlighter.write(markdown.slice(0, splitAt));
    res += highlighter.write(markdown.slice(splitAt));
    res += highlighter.end();

    expect(renderTerminalOutput(res, 120)).toBe(
      renderTerminalOutput(markdown, 120),
    );
  });
});
