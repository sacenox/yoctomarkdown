import * as colors from "yoctocolors";

export interface Theme {
  heading: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  link: (text: string) => string;
  listMarker: (text: string) => string;
  blockquote: (text: string) => string;
  hr: (text: string) => string;
}

const none: Theme = {
  heading: (t) => t,
  bold: (t) => t,
  italic: (t) => t,
  code: (t) => t,
  codeBlock: (t) => t,
  link: (t) => t,
  listMarker: (t) => t,
  blockquote: (t) => t,
  hr: (t) => t,
};

const minimal: Theme = {
  heading: colors.bold,
  bold: colors.bold,
  italic: colors.italic,
  code: colors.bgGray,
  codeBlock: colors.dim,
  link: colors.underline,
  listMarker: colors.dim,
  blockquote: colors.dim,
  hr: colors.dim,
};

const ansi16: Theme = {
  heading: (t) => colors.cyan(colors.bold(t)),
  bold: colors.bold,
  italic: colors.italic,
  code: (t) => colors.bgBlack(colors.yellow(t)),
  codeBlock: colors.yellow,
  link: colors.blue,
  listMarker: colors.magenta,
  blockquote: colors.green,
  hr: colors.gray,
};

const ansi256 = ansi16; // In a full implementation we might map specific 256 colors
const truecolor = ansi16; // Same

export const themes: Record<string, Theme> = {
  none,
  minimal,
  "16": ansi16,
  "256": ansi256,
  truecolor: truecolor,
};
