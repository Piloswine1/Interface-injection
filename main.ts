import { parse } from "https://deno.land/std@0.74.0/flags/mod.ts";
import { StartFormating } from "./essentials.ts";

const args = parse(Deno.args, {
  boolean: ["h", "i", "s", "l", "fix"],
  string: ["p", "x"],
  default: { p: ".", x: ["cs"], d: 1, i: false, s: false, l: false, fix: false },
});

if (args.h) {
  console.log("use inj <args> <files_to_include>");
  console.log(" if no files setted, considering all");
  console.log(" args:");
  console.log(" -l - unix-type newline");
  console.log(" -h - to show this help");
  console.log(" -p - to set working dir");
  console.log(" -s - to show or not formatted files");
  console.log(" -i - interactive, a.k. will be preemtive (default: true)");
  console.log(' -x - to set filetype to include (default: "cs")');
  console.log('   use as -x "filetype1" -x "filetype2" -x "filetype3"');
  console.log(" -d - max depth (default 1)");
  Deno.exit();
}

await StartFormating({
  dirpath: args.p,
  exts: [].concat(args.x),
  maxDepth: args.d,
  files: args._,
  preemptive: args.i,
  show: args.s,
  unixNewline: args.l,
  fix: args.fix
});
