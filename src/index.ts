import stripAnsi from "strip-ansi";
import stringWidth from "string-width";
import { type Theme, themes } from "./themes";
import { type InlineSpan, parseLineToken } from "./tokenizer";

export type { InlineSpan, BlockToken, TokenHighlighter } from "./tokenizer";
export { tokenize, createTokenizer } from "./tokenizer";

export interface Options {
  theme?: "16" | "256" | "truecolor" | "minimal" | "none" | Theme;
  tabWidth?: number;
  wordWrap?: number | "auto" | 0;
  yieldEvery?: number;
}

export interface Highlighter {
  write(chunk: string | Uint8Array): string;
  end(): string;
}

function resolveColumns(options?: Options): number {
  const wrap = options?.wordWrap ?? "auto";
  if (typeof wrap === "number" && wrap > 0) return wrap;
  if (wrap === "auto") {
    try {
      return process.stdout.columns || 80;
    } catch {
      return 80;
    }
  }
  // wordWrap === 0 (disabled) – use a large value so visual-line count stays 1
  return Number.MAX_SAFE_INTEGER;
}

function resolveTheme(options?: Options): Theme {
  const t = options?.theme || "16";
  if (typeof t === "string") {
    return (themes[t] || themes.none) as Theme;
  }
  return t as Theme;
}

// ── Token → ANSI rendering ──────────────────────────────────────────

function renderSpans(spans: InlineSpan[], theme: Theme): string {
  let result = "";
  for (const span of spans) {
    switch (span.type) {
      case "text":
        result += span.content;
        break;
      case "bold":
        result += theme.bold(`**${span.content}**`);
        break;
      case "italic":
        result += theme.italic(`*${span.content}*`);
        break;
      case "code":
        result += theme.code(`\`${span.content}\``);
        break;
      case "link":
        result += theme.link(`[${span.text}](${span.url})`);
        break;
    }
  }
  return result;
}

function renderLine(
  line: string,
  inCodeBlock: boolean,
  isPartial: boolean,
  theme: Theme,
): { rendered: string; newCodeBlockState: boolean } {
  // Inside a code block — render as code
  if (inCodeBlock) {
    const closing = line.trim().startsWith("```");
    return {
      rendered: theme.codeBlock(line),
      newCodeBlockState: !(closing && !isPartial),
    };
  }

  // Code block opening fence
  if (line.trim().startsWith("```")) {
    return {
      rendered: theme.codeBlock(line),
      newCodeBlockState: !isPartial,
    };
  }

  // For non-code lines, tokenize and render
  const token = parseLineToken(line, false);
  let rendered: string;
  switch (token.type) {
    case "hr":
      rendered = theme.hr(line);
      break;
    case "heading": {
      const hashes = "#".repeat(token.depth);
      rendered = theme.heading(`${hashes} ${renderSpans(token.spans, theme)}`);
      break;
    }
    case "blockquote": {
      const bqMatch = line.match(/^(>\s+)/);
      rendered =
        theme.blockquote(bqMatch?.[1] ?? "> ") +
        renderSpans(token.spans, theme);
      break;
    }
    case "list_item": {
      const markerMatch = line.match(/^((?:[-*]|\d+\.)\s+)/);
      rendered =
        theme.listMarker(markerMatch?.[1] ?? "") +
        renderSpans(token.spans, theme);
      break;
    }
    case "blank":
      rendered = "";
      break;
    case "paragraph":
      rendered = renderSpans(token.spans, theme);
      break;
    default:
      rendered = line;
      break;
  }

  return { rendered, newCodeBlockState: false };
}

// ── Public API ──────────────────────────────────────────────────────

export function highlightSync(input: string, options?: Options): string {
  const highlighter = createHighlighter(options);
  const out = highlighter.write(input);
  return out + highlighter.end();
}

export function createHighlighter(options?: Options): Highlighter {
  const theme = resolveTheme(options);
  const terminalColumns = resolveColumns(options);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let buffer = "";
  let inCodeBlock = false;

  function parseLine(line: string, isPartial: boolean): string {
    const { rendered, newCodeBlockState } = renderLine(
      line,
      inCodeBlock,
      isPartial,
      theme,
    );
    inCodeBlock = newCodeBlockState;
    return rendered;
  }

  let previousPartialRendered = "";

  // Compute actual terminal line count and last-line column,
  // simulating how the terminal wraps wide characters.
  // A 2-column char at the last column causes a gap + wrap.
  function terminalLayout(s: string): { lines: number; lastCol: number } {
    const stripped = stripAnsi(s);
    if (stripped.length === 0) return { lines: 1, lastCol: 0 };
    let lines = 1;
    let col = 0;
    for (const { segment } of segmenter.segment(stripped)) {
      const w = stringWidth(segment);
      if (w === 0) continue;
      if (col + w > terminalColumns) {
        lines++;
        col = w;
      } else {
        col += w;
      }
    }
    return { lines, lastCol: col };
  }

  // Erase the previous partial render by moving back over exactly the
  // characters we wrote and clearing from cursor to end of screen.
  // This preserves any text before our output on the same terminal line
  // (e.g. a prompt prefix), unlike \x1b[2K which erases the whole line.
  function erasePreviousPartial(): string {
    if (previousPartialRendered.length === 0) {
      return "";
    }
    const { lines, lastCol } = terminalLayout(previousPartialRendered);
    let seq = "";
    // Move cursor up for any extra wrapped lines beyond the first
    if (lines > 1) {
      seq += `\x1b[${lines - 1}A`;
    }
    // Move cursor back to start of our partial output
    if (lastCol > 0) {
      seq += `\x1b[${lastCol}D`;
    }
    // Erase from cursor to end of screen
    seq += "\x1b[0J";
    return seq;
  }

  return {
    write(chunk: string | Uint8Array): string {
      const text =
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      buffer += text;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let out = "";

      // If we have completed lines, we must erase the previous partial
      // (which was the in-progress version of the first completed line)
      // and re-render all completed lines plus the new partial.
      if (lines.length > 0) {
        out += erasePreviousPartial();
        out += `${lines.map((line) => parseLine(line, false)).join("\n")}\n`;
        previousPartialRendered = "";
      }

      if (buffer.length > 0) {
        const rendered = parseLine(buffer, true);
        // Append-only optimisation: if the new render starts with the
        // previous render, just emit the new suffix — no erase needed.
        // This avoids flicker and sidesteps character-width measurement
        // for the common case of appending plain text.
        if (
          lines.length === 0 &&
          previousPartialRendered.length > 0 &&
          rendered.startsWith(previousPartialRendered)
        ) {
          out += rendered.slice(previousPartialRendered.length);
        } else {
          // Render changed (e.g. inline formatting closed) — full redraw
          if (lines.length === 0) {
            out += erasePreviousPartial();
          }
          out += rendered;
        }
        previousPartialRendered = rendered;
      } else {
        previousPartialRendered = "";
      }

      return out;
    },
    end(): string {
      if (buffer.length > 0) {
        const rendered = parseLine(buffer, false);
        buffer = "";
        // If the final render matches the partial, nothing to redo.
        // If it differs (e.g. unclosed bold emitted as plain), erase and redraw.
        let out = "";
        if (rendered !== previousPartialRendered) {
          out += erasePreviousPartial();
          out += rendered;
        }
        previousPartialRendered = "";
        return out;
      }
      return "";
    },
  };
}
