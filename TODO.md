# yoctomarkdown — TODO

## Refactor: expose ANSI-free token API

**Motivation:** cel-tui's `Markdown` component needs structured tokens (not ANSI strings) to map markdown blocks to TUI nodes. The parser and renderer are currently interleaved — `parseLine` calls `theme.heading()`, `theme.bold()`, etc. inline. Split them so the parser produces tokens and the ANSI renderer becomes one consumer of those tokens.

**Consumer:** `@cel-tui/components` — see `packages/components/src/markdown.ts` in `~/src/cel-tui`, which currently has a placeholder local tokenizer that duplicates the parsing logic.

### Token types and API

See [spec.md — Token API](spec.md#token-api) for the full type definitions (`InlineSpan`, `BlockToken`) and function signatures (`tokenize`, `createTokenizer`).

### Refactor steps

- [x] Extract `parseInline` to return `InlineSpan[]` instead of an ANSI string
- [x] Extract `parseLine` to return `BlockToken` instead of an ANSI string
- [x] Add `tokenize(input)` — splits into lines, calls parseLine, returns `BlockToken[]`
- [x] Add `createTokenizer()` — same streaming model as `createHighlighter` but returns tokens
- [x] Rewrite `createHighlighter` to use tokenizer's `parseLineToken` + theme rendering on top
- [x] Export token types and tokenizer functions from `src/index.ts`
- [x] The ANSI renderer (`createHighlighter`, `highlightSync`) keeps its existing API and deps (`yoctocolors`, `string-width`, `strip-ansi`) — unchanged behavior
- [x] The token API (`tokenize`, `createTokenizer`, types) has **zero dependencies** — pure parsing (`src/tokenizer.ts`)

### Constraints

- [x] Existing `highlightSync` and `createHighlighter` APIs must not change (backward compatible)
- [x] Streaming behavior must be preserved — `createTokenizer().write()` emits completed block tokens immediately, buffers only the current incomplete line
- [x] Unclosed code blocks emit as `code_block` on `end()`
- [x] Unclosed inline formatting falls back to plain `text` spans
- [x] All existing tests must continue to pass (11 original + 39 new = 50 total)
- [x] Update spec.md to document the new token API
