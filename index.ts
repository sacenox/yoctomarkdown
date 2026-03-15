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

  function parseLine(line: string, _isLastLine: boolean): string {
    if (inCodeBlock) {
      if (line.trim().startsWith("```")) {
        inCodeBlock = false;
        return theme.codeBlock(line);
      }
      return theme.codeBlock(line);
    }

    if (line.trim().startsWith("```")) {
      inCodeBlock = true;
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

  return {
    write(chunk: string | Uint8Array): string {
      const text =
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      buffer += text;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      return (
        lines.map((line) => parseLine(line, false)).join("\n") +
        (lines.length > 0 ? "\n" : "")
      );
    },
    end(): string {
      if (buffer.length > 0) {
        const out = parseLine(buffer, true);
        buffer = "";
        return out;
      }
      return "";
    },
  };
}
