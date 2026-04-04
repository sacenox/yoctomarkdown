# yoctomarkdown — TODO

## Refactor: expose ANSI-free token API

**Motivation:** cel-tui's `Markdown` component needs structured tokens (not ANSI strings) to map markdown blocks to TUI nodes. The parser and renderer are currently interleaved — `parseLine` calls `theme.heading()`, `theme.bold()`, etc. inline. Split them so the parser produces tokens and the ANSI renderer becomes one consumer of those tokens.

**Consumer:** `@cel-tui/components` — see `packages/components/src/markdown.ts` in `~/src/cel-tui`, which currently has a placeholder local tokenizer that duplicates the parsing logic.

### Token types to expose

```ts
type InlineSpan =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; url: string };

type BlockToken =
  | { type: "heading"; depth: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "code_block"; lang: string; content: string }
  | { type: "list_item"; ordered: boolean; index: number; spans: InlineSpan[] }
  | { type: "blockquote"; spans: InlineSpan[] }
  | { type: "hr" }
  | { type: "blank" };
```

### API to expose

```ts
// Batch — tokenize a complete string
function tokenize(input: string): BlockToken[];

// Incremental — streaming chunk by chunk
interface TokenHighlighter {
  write(chunk: string | Uint8Array): BlockToken[];
  end(): BlockToken[];
}
function createTokenizer(): TokenHighlighter;
```

### Refactor steps

1. Extract `parseInline` to return `InlineSpan[]` instead of an ANSI string
2. Extract `parseLine` to return `BlockToken` instead of an ANSI string
3. Add `tokenize(input)` — splits into lines, calls parseLine, returns `BlockToken[]`
4. Add `createTokenizer()` — same streaming model as `createHighlighter` but returns tokens
5. Rewrite `createHighlighter` to use `createTokenizer` internally + theme rendering on top
6. Export token types and tokenizer functions from `src/index.ts`
7. The ANSI renderer (`createHighlighter`, `highlightSync`) keeps its existing API and deps (`yoctocolors`, `string-width`, `strip-ansi`) — unchanged behavior
8. The token API (`tokenize`, `createTokenizer`, types) has **zero dependencies** — pure parsing

### Constraints

- Existing `highlightSync` and `createHighlighter` APIs must not change (backward compatible)
- Streaming behavior must be preserved — `createTokenizer().write()` emits completed block tokens immediately, buffers only the current incomplete line
- Unclosed code blocks emit as `code_block` on `end()`
- Unclosed inline formatting falls back to plain `text` spans
- All existing tests must continue to pass
- Update spec.md to document the new token API
