import { parse } from "https://deno.land/std@0.74.0/flags/mod.ts";
import { StartFormating } from "./essentials.ts";

//-p - path
//-x - extentions
//-d - maxDepth
const args = parse(Deno.args, {
  string: ["p", "x"],
  default: { p: ".", x: ["cs"], d: 1 },
});

const promisies = StartFormating(args.p, [].concat(args.x), args.d);

Promise.all(promisies)
  .then(() => console.log("formatting ended"))
  .catch((err) => console.log(err));
