# yoctomarkdown

A small, fast, Bun-native Markdown highlighter for terminal output.

`yoctomarkdown` reads Markdown and writes ANSI-colored text to stdout or returns it as a string. It focuses on simple, fast, incremental rendering for CLI and programmatic use, supporting a practical subset of Markdown specifically for terminal display.

## Features

- **Incremental processing**: Stream chunks of Markdown without buffering the entire document.
- **Terminal optimized**: Styles headings, code blocks, lists, and more using `yoctocolors`.
- **Flexible**: Use it as a library (`highlightSync`, `createHighlighter`) or as a CLI tool.
- **Fast**: Built for the Bun runtime.

## Installation

[npm package](https://www.npmjs.com/package/yoctomarkdown)

```bash
bun add yoctomarkdown
```

## Usage

### CLI

Run via the command line:

```bash
# Read from a file
yoctomarkdown README.md

# Read from stdin
cat README.md | yoctomarkdown
```

**Options:**

- `-t, --theme <name>`: Theme to use (`16`, `256`, `truecolor`, `minimal`, `none`). Defaults to `16`.
- `-w, --wrap <n|auto|0>`: Word wrapping length. Defaults to `auto` (terminal width).
- `-h, --help`: Show help.

### Library API

You can use `yoctomarkdown` programmatically in two ways: synchronously for complete strings, or incrementally via the highlighter.

#### Synchronous

```typescript
import { highlightSync } from "yoctomarkdown";

const markdown = "# Hello World\n\nThis is **bold** text.";
const output = highlightSync(markdown, { theme: "truecolor" });
console.log(output);
```

#### Streaming / Incremental

```typescript
import { createHighlighter } from "yoctomarkdown";

const highlighter = createHighlighter({ theme: "16" });

process.stdout.write(highlighter.write("# Chunk 1\n"));
process.stdout.write(highlighter.write("Some *italic* text in Chunk 2.\n"));
process.stdout.write(highlighter.end());
```

## Options

```typescript
interface Options {
  theme?: "16" | "256" | "truecolor" | "minimal" | "none" | Theme; // default: "16"
  tabWidth?: number; // default: 2
  wordWrap?: number | "auto" | 0; // default: "auto"
  yieldEvery?: number; // default: 1000
}
```

## Supported Markdown

- Headings (`#`, `##`, `###`)
- Bold (`**text**`) and Italic (`*text*`)
- Inline code (` \`code\` `) and Fenced code blocks (` ``` `)
- Links (`[text](url)`)
- Lists (`-`, `*`, `1.`)
- Blockquotes (`>`)
- Horizontal rules (`---`)

Unsupported Markdown elements are preserved as plain text.

## Scripts

To contribute or develop locally, the following commands are available:

- `bun run check`: Runs formatting, linting, typechecking, and duplication checks.
- `bun run format`: Formats code using Prettier.
- `bun test`: Runs tests.
