// Pure token-based Markdown parser — zero dependencies.

export type InlineSpan =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; url: string };

export type BlockToken =
  | { type: "heading"; depth: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "code_block"; lang: string; content: string }
  | { type: "list_item"; ordered: boolean; index: number; spans: InlineSpan[] }
  | { type: "blockquote"; spans: InlineSpan[] }
  | { type: "hr" }
  | { type: "blank" };

export interface TokenHighlighter {
  write(chunk: string | Uint8Array): BlockToken[];
  end(): BlockToken[];
}

// ── Inline parsing ───────────────────────────────────────────────────

function parseInlineTokens(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let i = 0;
  let plainStart = i;

  function flushPlain() {
    if (plainStart < i) {
      spans.push({ type: "text", content: text.slice(plainStart, i) });
    }
  }

  while (i < text.length) {
    // Inline code (highest priority)
    if (text[i] === "`" && text[i + 1] !== "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flushPlain();
        spans.push({ type: "code", content: text.slice(i + 1, end) });
        i = end + 1;
        plainStart = i;
        continue;
      }
    }

    // Bold **text**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flushPlain();
        spans.push({ type: "bold", content: text.slice(i + 2, end) });
        i = end + 2;
        plainStart = i;
        continue;
      }
    }

    // Italic *text* (not preceded by another *)
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end + 1] !== "*") {
        flushPlain();
        spans.push({ type: "italic", content: text.slice(i + 1, end) });
        i = end + 1;
        plainStart = i;
        continue;
      }
    }

    // Link [text](url)
    if (text[i] === "[") {
      const bracketEnd = text.indexOf("]", i + 1);
      if (bracketEnd !== -1 && text[bracketEnd + 1] === "(") {
        const parenEnd = text.indexOf(")", bracketEnd + 2);
        if (parenEnd !== -1) {
          flushPlain();
          spans.push({
            type: "link",
            text: text.slice(i + 1, bracketEnd),
            url: text.slice(bracketEnd + 2, parenEnd),
          });
          i = parenEnd + 1;
          plainStart = i;
          continue;
        }
      }
    }

    i++;
  }

  // Remaining plain text
  if (plainStart < text.length) {
    spans.push({ type: "text", content: text.slice(plainStart) });
  }

  return spans;
}

// ── Block parsing ────────────────────────────────────────────────────

export function parseLineToken(line: string, inCodeBlock: boolean): BlockToken {
  if (inCodeBlock) {
    // This function doesn't handle code block accumulation — that's
    // done at the higher level. This shouldn't be called for lines
    // inside a code block. Kept as a safety fallback.
    return { type: "paragraph", spans: [{ type: "text", content: line }] };
  }

  // Fenced code block start — handled at higher level
  if (line.trim().startsWith("```")) {
    // Shouldn't normally reach here; the higher-level handles code blocks
    return { type: "paragraph", spans: [{ type: "text", content: line }] };
  }

  // Horizontal rule
  if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
    return { type: "hr" };
  }

  // Heading
  const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
  if (headingMatch) {
    const depth = (headingMatch[1]?.length ?? 1) as 1 | 2 | 3;
    const text = headingMatch[2] ?? "";
    return { type: "heading", depth, spans: parseInlineTokens(text) };
  }

  // Blockquote
  const bqMatch = line.match(/^>\s+(.*)$/);
  if (bqMatch) {
    return { type: "blockquote", spans: parseInlineTokens(bqMatch[1] ?? "") };
  }

  // Unordered list
  const ulMatch = line.match(/^[-*]\s+(.*)$/);
  if (ulMatch) {
    return {
      type: "list_item",
      ordered: false,
      index: 0,
      spans: parseInlineTokens(ulMatch[1] ?? ""),
    };
  }

  // Ordered list
  const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
  if (olMatch) {
    return {
      type: "list_item",
      ordered: true,
      index: parseInt(olMatch[1] ?? "0", 10),
      spans: parseInlineTokens(olMatch[2] ?? ""),
    };
  }

  // Blank line
  if (line.trim() === "") {
    return { type: "blank" };
  }

  // Plain paragraph
  return { type: "paragraph", spans: parseInlineTokens(line) };
}

// ── Batch tokenizer ─────────────────────────────────────────────────

export function tokenize(input: string): BlockToken[] {
  const tokenizer = createTokenizer();
  const tokens = tokenizer.write(input);
  tokens.push(...tokenizer.end());
  return tokens;
}

// ── Streaming tokenizer ─────────────────────────────────────────────

export function createTokenizer(): TokenHighlighter {
  let buffer = "";
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines: string[] = [];

  function processLine(line: string): BlockToken | null {
    // Inside a code block
    if (inCodeBlock) {
      if (line.trim().startsWith("```")) {
        inCodeBlock = false;
        const token: BlockToken = {
          type: "code_block",
          lang: codeLang,
          content: codeLines.join("\n"),
        };
        codeLang = "";
        codeLines = [];
        return token;
      }
      codeLines.push(line);
      return null;
    }

    // Start a code block
    if (line.trim().startsWith("```")) {
      inCodeBlock = true;
      const langMatch = line.trim().match(/^```(\S*)$/);
      codeLang = langMatch?.[1] ?? "";
      codeLines = [];
      return null;
    }

    return parseLineToken(line, false);
  }

  return {
    write(chunk: string | Uint8Array): BlockToken[] {
      const text =
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
      buffer += text;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      const tokens: BlockToken[] = [];
      for (const line of lines) {
        const token = processLine(line);
        if (token) tokens.push(token);
      }

      return tokens;
    },

    end(): BlockToken[] {
      const tokens: BlockToken[] = [];

      // Flush remaining buffer
      if (buffer.length > 0) {
        const token = processLine(buffer);
        if (token) tokens.push(token);
        buffer = "";
      }

      // Flush unclosed code block
      if (inCodeBlock) {
        tokens.push({
          type: "code_block",
          lang: codeLang,
          content: codeLines.join("\n"),
        });
        inCodeBlock = false;
        codeLang = "";
        codeLines = [];
      }

      return tokens;
    },
  };
}
