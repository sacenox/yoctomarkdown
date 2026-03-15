#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createHighlighter, type Options } from "./index";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    theme: { type: "string", short: "t" },
    wrap: { type: "string", short: "w" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: yoctomarkdown [options] [file]

Options:
  -t, --theme <name>    Theme to use: 16, 256, truecolor, minimal, none (default: 16)
  -w, --wrap <n|auto|0> Word wrap setting (default: auto)
  -h, --help            Show this help message
`);
  process.exit(0);
}

const themeName = values.theme || "16";
const validThemes = ["16", "256", "truecolor", "minimal", "none"];
if (!validThemes.includes(themeName)) {
  console.error(`Invalid theme: ${themeName}`);
  process.exit(1);
}

const wrapVal = values.wrap || "auto";
let wordWrap: number | "auto" | 0 = "auto";
if (wrapVal === "auto" || wrapVal === "0") {
  wordWrap = wrapVal === "auto" ? "auto" : 0;
} else {
  const n = parseInt(wrapVal, 10);
  if (Number.isNaN(n) || n < 0) {
    console.error(`Invalid wrap value: ${wrapVal}`);
    process.exit(1);
  }
  wordWrap = n;
}

const options: Options = {
  theme: themeName as Options["theme"],
  wordWrap,
};

const highlighter = createHighlighter(options);

async function run() {
  if (positionals.length > 0) {
    const file = positionals[0] as string;
    try {
      const content = readFileSync(file, "utf8");
      process.stdout.write(highlighter.write(content));
      process.stdout.write(highlighter.end());
    } catch (err: unknown) {
      console.error(
        `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  } else {
    for await (const chunk of process.stdin) {
      process.stdout.write(highlighter.write(chunk));
    }
    process.stdout.write(highlighter.end());
  }
}

run();
