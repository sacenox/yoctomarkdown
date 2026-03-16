import stripAnsi from "strip-ansi";
import stringWidth from "string-width";
import { type Theme, themes } from "./themes";

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

  function parseInline(text: string): string {
    let result = "";
    let i = 0;
    while (i < text.length) {
      if (text.startsWith("`", i) && !text.startsWith("``", i)) {
        const end = text.indexOf("`", i + 1);
        if (end !== -1) {
          result += theme.code(`\`${text.slice(i + 1, end)}\``);
          i = end + 1;
          continue;
        }
      }

      if (text.startsWith("**", i)) {
        const end = text.indexOf("**", i + 2);
        if (end !== -1) {
          result += theme.bold(`**${text.slice(i + 2, end)}**`);
          i = end + 2;
          continue;
        }
      }

      if (text.startsWith("*", i) && !text.startsWith("**", i)) {
        const end = text.indexOf("*", i + 1);
        if (end !== -1 && !text.startsWith("**", end)) {
          result += theme.italic(`*${text.slice(i + 1, end)}*`);
          i = end + 1;
          continue;
        }
      }

      if (text.startsWith("[", i)) {
        const bracketEnd = text.indexOf("]", i + 1);
        if (bracketEnd !== -1 && text.charAt(bracketEnd + 1) === "(") {
          const parenEnd = text.indexOf(")", bracketEnd + 2);
          if (parenEnd !== -1) {
            result += theme.link(
              `[${text.slice(i + 1, bracketEnd)}](${text.slice(bracketEnd + 2, parenEnd)})`,
            );
            i = parenEnd + 1;
            continue;
          }
        }
      }

      result += text[i];
      i++;
    }

    return result;
  }

  function parseLine(line: string, isPartial: boolean): string {
    if (inCodeBlock) {
      if (line.trim().startsWith("```")) {
        if (!isPartial) inCodeBlock = false;
        return theme.codeBlock(line);
      }
      return theme.codeBlock(line);
    }

    if (line.trim().startsWith("```")) {
      if (!isPartial) inCodeBlock = true;
      return theme.codeBlock(line);
    }

    const hrMatch = line.trim().match(/^(?:-{3,}|\*{3,}|_{3,})$/);
    if (hrMatch) {
      return theme.hr(line);
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const hashes = headingMatch[1] ?? "";
      const text = headingMatch[2] ?? "";
      return theme.heading(`${hashes} ${parseInline(text)}`);
    }

    const bqMatch = line.match(/^(>\s+)(.*)$/);
    if (bqMatch) {
      return theme.blockquote(bqMatch[1] ?? "") + parseInline(bqMatch[2] ?? "");
    }

    const ulMatch = line.match(/^([-*]\s+)(.*)$/);
    if (ulMatch) {
      return theme.listMarker(ulMatch[1] ?? "") + parseInline(ulMatch[2] ?? "");
    }

    const olMatch = line.match(/^(\d+\.\s+)(.*)$/);
    if (olMatch) {
      return theme.listMarker(olMatch[1] ?? "") + parseInline(olMatch[2] ?? "");
    }

    return parseInline(line);
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
