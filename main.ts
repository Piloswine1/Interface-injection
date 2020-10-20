import { parse } from "https://deno.land/std@0.74.0/flags/mod.ts";
import { StartFormating } from "./essentials.ts";

//-p - path
//-x - extentions
//-d - maxDepth
const args = parse(Deno.args, {
  boolean: ["h"],
  string: ["p", "x"],
  default: { p: ".", x: ["cs"], d: 1 },
});

if (args.h) {
  console.log("use inj <args> <files_to_include>")
  console.log(" if no files setted, considering all")
  console.log(" args:")
  console.log(" -h - to show this help")
  console.log(" -p - to set working dir")
  console.log(" -x - to set filetype to include (default: \"cs\")")
  console.log("   use as -x \"filetype1\" -x \"filetype2\" -x \"filetype3\"")
  console.log(" -d - max depth (default 1)")
  Deno.exit();
}
const promisies = StartFormating(args.p, [].concat(args.x), args.d, args._);

Promise.all(promisies)
  .then(() => console.log("formatting ended"))
  .catch((err) => console.log(err));
