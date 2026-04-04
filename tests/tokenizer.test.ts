import { test, expect, describe } from "bun:test";
import { tokenize, createTokenizer, type BlockToken } from "../src/index";

// ── Inline span parsing ──────────────────────────────────────────────

describe("tokenize: inline spans", () => {
  test("plain text", () => {
    const tokens = tokenize("Hello world");
    expect(tokens).toEqual([
      { type: "paragraph", spans: [{ type: "text", content: "Hello world" }] },
    ]);
  });

  test("bold", () => {
    const tokens = tokenize("some **bold** text");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", content: "some " },
          { type: "bold", content: "bold" },
          { type: "text", content: " text" },
        ],
      },
    ]);
  });

  test("italic", () => {
    const tokens = tokenize("some *italic* text");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", content: "some " },
          { type: "italic", content: "italic" },
          { type: "text", content: " text" },
        ],
      },
    ]);
  });

  test("inline code", () => {
    const tokens = tokenize("use `foo()` here");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", content: "use " },
          { type: "code", content: "foo()" },
          { type: "text", content: " here" },
        ],
      },
    ]);
  });

  test("link", () => {
    const tokens = tokenize("click [here](https://example.com) now");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "text", content: "click " },
          { type: "link", text: "here", url: "https://example.com" },
          { type: "text", content: " now" },
        ],
      },
    ]);
  });

  test("mixed inline formatting", () => {
    const tokens = tokenize("**bold** and *italic* and `code`");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [
          { type: "bold", content: "bold" },
          { type: "text", content: " and " },
          { type: "italic", content: "italic" },
          { type: "text", content: " and " },
          { type: "code", content: "code" },
        ],
      },
    ]);
  });

  test("unclosed bold falls back to text", () => {
    const tokens = tokenize("some **unclosed bold");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", content: "some **unclosed bold" }],
      },
    ]);
  });

  test("unclosed italic falls back to text", () => {
    const tokens = tokenize("some *unclosed italic");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", content: "some *unclosed italic" }],
      },
    ]);
  });

  test("unclosed inline code falls back to text", () => {
    const tokens = tokenize("some `unclosed code");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "text", content: "some `unclosed code" }],
      },
    ]);
  });

  test("inline code takes priority over bold", () => {
    const tokens = tokenize("`**not bold**`");
    expect(tokens).toEqual([
      {
        type: "paragraph",
        spans: [{ type: "code", content: "**not bold**" }],
      },
    ]);
  });
});

// ── Block-level tokens ───────────────────────────────────────────────

describe("tokenize: block tokens", () => {
  test("heading 1", () => {
    const tokens = tokenize("# Hello");
    expect(tokens).toEqual([
      {
        type: "heading",
        depth: 1,
        spans: [{ type: "text", content: "Hello" }],
      },
    ]);
  });

  test("heading 2", () => {
    const tokens = tokenize("## Sub");
    expect(tokens).toEqual([
      {
        type: "heading",
        depth: 2,
        spans: [{ type: "text", content: "Sub" }],
      },
    ]);
  });

  test("heading 3", () => {
    const tokens = tokenize("### Third");
    expect(tokens).toEqual([
      {
        type: "heading",
        depth: 3,
        spans: [{ type: "text", content: "Third" }],
      },
    ]);
  });

  test("heading with inline formatting", () => {
    const tokens = tokenize("# **Bold** heading");
    expect(tokens).toEqual([
      {
        type: "heading",
        depth: 1,
        spans: [
          { type: "bold", content: "Bold" },
          { type: "text", content: " heading" },
        ],
      },
    ]);
  });

  test("fenced code block", () => {
    const tokens = tokenize("```js\nconst x = 1;\n```");
    expect(tokens).toEqual([
      { type: "code_block", lang: "js", content: "const x = 1;" },
    ]);
  });

  test("fenced code block without language", () => {
    const tokens = tokenize("```\nhello\n```");
    expect(tokens).toEqual([
      { type: "code_block", lang: "", content: "hello" },
    ]);
  });

  test("fenced code block with multiple lines", () => {
    const tokens = tokenize("```\nline1\nline2\nline3\n```");
    expect(tokens).toEqual([
      { type: "code_block", lang: "", content: "line1\nline2\nline3" },
    ]);
  });

  test("unclosed code block emits as code_block on end", () => {
    const tokens = tokenize("```\nunclosed code");
    expect(tokens).toEqual([
      { type: "code_block", lang: "", content: "unclosed code" },
    ]);
  });

  test("unordered list item with dash", () => {
    const tokens = tokenize("- Item one");
    expect(tokens).toEqual([
      {
        type: "list_item",
        ordered: false,
        index: 0,
        spans: [{ type: "text", content: "Item one" }],
      },
    ]);
  });

  test("unordered list item with asterisk", () => {
    const tokens = tokenize("* Item two");
    expect(tokens).toEqual([
      {
        type: "list_item",
        ordered: false,
        index: 0,
        spans: [{ type: "text", content: "Item two" }],
      },
    ]);
  });

  test("ordered list item", () => {
    const tokens = tokenize("1. First");
    expect(tokens).toEqual([
      {
        type: "list_item",
        ordered: true,
        index: 1,
        spans: [{ type: "text", content: "First" }],
      },
    ]);
  });

  test("ordered list preserves index", () => {
    const tokens = tokenize("3. Third");
    expect(tokens).toEqual([
      {
        type: "list_item",
        ordered: true,
        index: 3,
        spans: [{ type: "text", content: "Third" }],
      },
    ]);
  });

  test("blockquote", () => {
    const tokens = tokenize("> quoted text");
    expect(tokens).toEqual([
      {
        type: "blockquote",
        spans: [{ type: "text", content: "quoted text" }],
      },
    ]);
  });

  test("blockquote with inline formatting", () => {
    const tokens = tokenize("> **bold** quote");
    expect(tokens).toEqual([
      {
        type: "blockquote",
        spans: [
          { type: "bold", content: "bold" },
          { type: "text", content: " quote" },
        ],
      },
    ]);
  });

  test("horizontal rule ---", () => {
    const tokens = tokenize("---");
    expect(tokens).toEqual([{ type: "hr" }]);
  });

  test("horizontal rule ***", () => {
    const tokens = tokenize("***");
    expect(tokens).toEqual([{ type: "hr" }]);
  });

  test("horizontal rule ___", () => {
    const tokens = tokenize("___");
    expect(tokens).toEqual([{ type: "hr" }]);
  });

  test("blank line", () => {
    const tokens = tokenize("hello\n\nworld");
    expect(tokens).toEqual([
      { type: "paragraph", spans: [{ type: "text", content: "hello" }] },
      { type: "blank" },
      { type: "paragraph", spans: [{ type: "text", content: "world" }] },
    ]);
  });
});

// ── Full document tokenization ───────────────────────────────────────

describe("tokenize: full documents", () => {
  test("mixed content document", () => {
    const input = [
      "# Title",
      "",
      "Some **bold** and *italic* text.",
      "",
      "```js",
      "const x = 1;",
      "```",
      "",
      "- item 1",
      "- item 2",
      "",
      "> a quote",
      "",
      "---",
    ].join("\n");

    const tokens = tokenize(input);
    expect(tokens[0]).toEqual({
      type: "heading",
      depth: 1,
      spans: [{ type: "text", content: "Title" }],
    });
    expect(tokens[1]).toEqual({ type: "blank" });
    expect(tokens[2]).toMatchObject({ type: "paragraph" });
    expect(tokens[3]).toEqual({ type: "blank" });
    expect(tokens[4]).toEqual({
      type: "code_block",
      lang: "js",
      content: "const x = 1;",
    });
    expect(tokens[5]).toEqual({ type: "blank" });
    expect(tokens[6]).toMatchObject({
      type: "list_item",
      ordered: false,
      index: 0,
    });
    expect(tokens[7]).toMatchObject({
      type: "list_item",
      ordered: false,
      index: 0,
    });
    expect(tokens[8]).toEqual({ type: "blank" });
    expect(tokens[9]).toMatchObject({ type: "blockquote" });
    expect(tokens[10]).toEqual({ type: "blank" });
    expect(tokens[11]).toEqual({ type: "hr" });
  });
});

// ── Streaming tokenizer ─────────────────────────────────────────────

describe("createTokenizer: streaming", () => {
  test("basic streaming produces same tokens as batch", () => {
    const input = "# Hello\n\nSome **bold** text.\n";
    const batchTokens = tokenize(input);

    const tokenizer = createTokenizer();
    const streamTokens: BlockToken[] = [];
    streamTokens.push(...tokenizer.write(input));
    streamTokens.push(...tokenizer.end());

    expect(streamTokens).toEqual(batchTokens);
  });

  test("character-by-character streaming", () => {
    const input = "# Title\n\n- item 1\n- item 2\n";
    const batchTokens = tokenize(input);

    const tokenizer = createTokenizer();
    const streamTokens: BlockToken[] = [];
    for (const ch of input) {
      streamTokens.push(...tokenizer.write(ch));
    }
    streamTokens.push(...tokenizer.end());

    expect(streamTokens).toEqual(batchTokens);
  });

  test("chunks split across line boundaries", () => {
    const tokenizer = createTokenizer();
    const tokens: BlockToken[] = [];

    tokens.push(...tokenizer.write("# Hea"));
    tokens.push(...tokenizer.write("ding\n"));
    tokens.push(...tokenizer.write("\nSome text\n"));
    tokens.push(...tokenizer.end());

    expect(tokens[0]).toEqual({
      type: "heading",
      depth: 1,
      spans: [{ type: "text", content: "Heading" }],
    });
    expect(tokens[1]).toEqual({ type: "blank" });
    expect(tokens[2]).toEqual({
      type: "paragraph",
      spans: [{ type: "text", content: "Some text" }],
    });
  });

  test("emits completed tokens immediately", () => {
    const tokenizer = createTokenizer();

    // Incomplete line — no token emitted yet
    const t1 = tokenizer.write("# Hel");
    expect(t1).toEqual([]);

    // Complete the line — token emitted
    const t2 = tokenizer.write("lo\n");
    expect(t2).toEqual([
      {
        type: "heading",
        depth: 1,
        spans: [{ type: "text", content: "Hello" }],
      },
    ]);
  });

  test("buffers only incomplete line", () => {
    const tokenizer = createTokenizer();

    const t1 = tokenizer.write("hello\nwor");
    expect(t1).toEqual([
      { type: "paragraph", spans: [{ type: "text", content: "hello" }] },
    ]);

    // "wor" is buffered, flushed on end()
    const t2 = tokenizer.end();
    expect(t2).toEqual([
      { type: "paragraph", spans: [{ type: "text", content: "wor" }] },
    ]);
  });

  test("code block spanning multiple writes", () => {
    const tokenizer = createTokenizer();
    const tokens: BlockToken[] = [];

    tokens.push(...tokenizer.write("```js\ncon"));
    tokens.push(...tokenizer.write("st x = 1;\n```\n"));
    tokens.push(...tokenizer.end());

    expect(tokens).toContainEqual({
      type: "code_block",
      lang: "js",
      content: "const x = 1;",
    });
  });

  test("unclosed code block flushed on end()", () => {
    const tokenizer = createTokenizer();
    const tokens: BlockToken[] = [];

    tokens.push(...tokenizer.write("```\nsome code"));
    tokens.push(...tokenizer.end());

    expect(tokens).toContainEqual({
      type: "code_block",
      lang: "",
      content: "some code",
    });
  });

  test("accepts Uint8Array chunks", () => {
    const tokenizer = createTokenizer();
    const tokens: BlockToken[] = [];

    tokens.push(...tokenizer.write(new TextEncoder().encode("# Hello\n")));
    tokens.push(...tokenizer.end());

    expect(tokens).toEqual([
      {
        type: "heading",
        depth: 1,
        spans: [{ type: "text", content: "Hello" }],
      },
    ]);
  });

  test("random chunk sizes match batch", () => {
    const input =
      "```javascript\nconst x = 1;\n```\n\n# Heading 2\n\nSome text with `code`.\n> Blockquote here\n\n1. One\n2. Two\n";
    const batchTokens = tokenize(input);

    const tokenizer = createTokenizer();
    const streamTokens: BlockToken[] = [];

    let i = 0;
    while (i < input.length) {
      const chunkSize = Math.floor(Math.random() * 10) + 1;
      streamTokens.push(...tokenizer.write(input.slice(i, i + chunkSize)));
      i += chunkSize;
    }
    streamTokens.push(...tokenizer.end());

    expect(streamTokens).toEqual(batchTokens);
  });
});

// ── Performance ──────────────────────────────────────────────────────

describe("tokenizer: performance", () => {
  test("batch tokenize 5000 blocks under 200ms", () => {
    const largeMd = "# Heading\n\nSome **bold** text here.\n".repeat(5000);
    const start = performance.now();
    tokenize(largeMd);
    const duration = performance.now() - start;
    console.log(`Token batch parse time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(200);
  });
});
