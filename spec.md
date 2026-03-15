# YoctoMarkdown Specification

YoctoMarkdown is a small Bun-native Markdown highlighter for terminal output.
It reads Markdown and writes ANSI-colored text to stdout or returns it as a string.
The focus is simple, fast, incremental rendering for CLI and Programmatic use.

## Overview

YoctoMarkdown MUST:

- accept Markdown from a complete string, a file, or a stream
- process input incrementally
- render supported Markdown syntax as ANSI-styled terminal text
- preserve unsupported or malformed Markdown as plain text
- avoid buffering the full document when used in streaming mode

YoctoMarkdown is not a full CommonMark implementation.
It supports a small, practical subset intended for terminal display.

## Dependencies

YoctoMarkdown is intended to use:

- **Bun** as the runtime, stream, and build tool
- **yoctocolors** from npm for ANSI color rendering - https://github.com/sindresorhus/yoctocolors

## Supported Markdown

Version 1 supports the following syntax:

| Element           | Syntax             | Behavior           |
| ----------------- | ------------------ | ------------------ |
| Heading 1         | `# Title`          | styled heading     |
| Heading 2         | `## Title`         | styled heading     |
| Heading 3         | `### Title`        | styled heading     |
| Bold              | `**text**`         | styled inline text |
| Italic            | `*text*`           | styled inline text |
| Inline code       | `` `code` ``       | styled inline code |
| Fenced code block | ` ``` `            | styled block code  |
| Link              | `[text](url)`      | styled link text   |
| Unordered list    | `- item`, `* item` | styled marker      |
| Ordered list      | `1. item`          | styled marker      |
| Blockquote        | `> quote`          | styled marker      |
| Horizontal rule   | `---`              | styled rule        |
| Plain text        | any other text     | unchanged text     |

Unsupported syntax MUST be rendered as plain text.

## Parsing Rules

The parser is line-aware and incremental.

### Block rules

- Headings are recognized only at the start of a line.
- Only `#`, `##`, and `###` headings are supported.
- Fenced code blocks use triple backticks.
- Inside a fenced code block, all text is treated as code until a closing triple backtick fence is found.
- Horizontal rules are recognized only when the full trimmed line is `---`, `***`, or `___`.
- List and blockquote markers are recognized only at the start of a line.

### Inline rules

- Inline code has priority over other inline formatting.
- Links are recognized only in the form `[text](url)`.
- Bold uses `**text**`.
- Italic uses `*text*`.
- Nested or ambiguous inline formatting is not required to match full CommonMark behavior.

### Malformed input

- Incomplete inline constructs MAY remain buffered while more input is expected.
- At end of input, any unclosed inline construct MUST be emitted as plain text.
- An unclosed fenced code block MUST render as code until end of input.

## Streaming Behavior

Streaming mode MUST work chunk by chunk.

For each chunk:

1. append the chunk to an internal buffer
2. parse as much complete Markdown as possible
3. render completed output immediately
4. keep only unresolved trailing text in the buffer

The implementation MUST preserve enough state to handle syntax split across chunk boundaries.

## Rendering

Rendering maps recognized Markdown elements to ANSI styles.

The implementation MUST provide these built-in theme names:

- `16`
- `256`
- `truecolor`
- `minimal`
- `none`

Theme behavior:

- headings MUST be visually distinct from plain text
- bold and italic SHOULD be visually distinct from plain text
- code and code blocks MUST be visually distinct from surrounding text
- links SHOULD be visually distinct from plain text
- list and blockquote markers MAY be styled independently
- `none` MUST disable ANSI styling entirely

The exact colors are implementation-defined.

## Configuration

The implementation MUST support the following options:

```ts
interface Options {
  theme?: "16" | "256" | "truecolor" | "minimal" | "none" | Theme;
  tabWidth?: number;
  wordWrap?: number | "auto" | 0;
  yieldEvery?: number;
}
```

Default values:

- `theme`: `'16'`
- `tabWidth`: `2`
- `wordWrap`: `'auto'`
- `yieldEvery`: `1000`

### Word wrap

If wrapping is enabled:

- `'auto'` means terminal width when available, otherwise `80`
- `0` disables wrapping
- ANSI escape sequences MUST NOT count toward visible width

## Library API

The library MUST expose:

```ts
highlightSync(input: string, options?: Options): string
createHighlighter(options?: Options): Highlighter
```

```ts
interface Highlighter {
  write(chunk: string | Uint8Array): string;
  end(): string;
}
```

Behavior:

- `highlightSync()` returns the fully rendered ANSI string for a complete input string
- `createHighlighter()` returns an incremental highlighter
- `write()` returns rendered output for the provided chunk
- `end()` flushes any remaining buffered text

## CLI

The CLI command is:

```text
yoctomarkdown [options] [file]
```

If `file` is provided, the CLI reads that file.
Otherwise, it reads from stdin.

Supported options:

- `-t, --theme <name>`
- `-w, --wrap <n|auto|0>`
- `-h, --help`

The CLI MUST:

- write rendered output to stdout
- write diagnostics to stderr
- exit with status `0` on success
- exit with non-zero status on input or argument errors

## Non-Goals

- full CommonMark compliance
- GFM extensions such as tables, task lists, or strikethrough
- HTML rendering
- syntax highlighting inside code blocks
- AST generation
