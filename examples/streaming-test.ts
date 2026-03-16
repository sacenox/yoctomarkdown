/**
 * Streaming API test app for yoctomarkdown.
 *
 * Simulates LLM-style character-by-character streaming to verify
 * that partial line redraw works without duplicate lines.
 *
 * Usage:  bun examples/streaming-test.ts
 */

import { createHighlighter } from "../src/index.ts";

const markdown = `# Streaming Test

This is **bold text** and *italic text* with \`inline code\`.

## Code Block

\`\`\`
function hello() {
  console.log("world");
}
\`\`\`

## Lists

- First item with **bold**
- Second item with \`code\`
- Third item

1. Ordered one
2. Ordered two

> A blockquote with *emphasis*

---

A [link](https://example.com) and some final text.

This is a longer paragraph that should cause terminal wrapping when the terminal is narrow enough. It contains **bold words** and *italic words* and \`inline code snippets\` to verify that partial re-rendering handles wrapped lines correctly without duplicating content on screen.
`;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function streamWithPrefix(prefix: string, text: string) {
  const highlighter = createHighlighter({ theme: "truecolor" });

  // Write the prefix directly — it's not part of the highlighter output
  process.stdout.write(prefix);

  // Stream character by character with a small delay to make it visible
  for (let i = 0; i < text.length; i++) {
    const output = highlighter.write(text[i]!);
    if (output) process.stdout.write(output);
    await delay(8);
  }

  // Flush remaining
  const final = highlighter.end();
  if (final) process.stdout.write(final);

  process.stdout.write("\n");
}

async function main() {
  // 1. Standard full-document streaming
  const highlighter = createHighlighter({ theme: "truecolor" });

  for (let i = 0; i < markdown.length; i++) {
    const output = highlighter.write(markdown[i]!);
    if (output) process.stdout.write(output);
    await delay(8);
  }

  const final = highlighter.end();
  if (final) process.stdout.write(final);
  process.stdout.write("\n");

  // 2. Inline prefix preservation — short line (should NOT erase prefix)
  await streamWithPrefix("AI: ", "Here is some **bold** and *italic* text.");

  // 3. Inline prefix preservation — long line that wraps
  await streamWithPrefix(
    "Assistant: ",
    "This is a much longer response that should wrap across multiple terminal lines to test the edge case where cursor-back might overshoot past the prefix on the first visual line.",
  );

  // 4. Multiple prefixed responses in sequence
  await streamWithPrefix("Q: ", "What is `yoctomarkdown`?");
  await streamWithPrefix(
    "A: ",
    "A **tiny** streaming markdown highlighter for the terminal.",
  );
}

main();
