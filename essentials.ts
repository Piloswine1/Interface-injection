// import * as log from "https://deno.land/std@0.74.0/log/mod.ts"
import { readLines } from "https://deno.land/std@0.74.0/io/mod.ts";
import { walkSync } from "https://deno.land/std@0.74.0/fs/mod.ts"; //XXX: may be unstable

const INTERFACE = "IDisposable";
const INTERFACE_IMPL =
  "public void Dispose() {throw new NotImplementedException();}";
const NEWLINE = "\r\n";

const StartFormating = (
  dirpath: string,
  exts: string[],
  maxDepth: number,
) => {
  const PromiseList: Promise<void>[] = [];
  for (const file of walkSync(dirpath, { exts, maxDepth })) {
    console.log("FileName: " + file.path);
    PromiseList.push(FormatFile(file.path));
  }
  return PromiseList;
};
const FormatFile = async (filename: string) => {
  const encoder = new TextEncoder();
  // const decoder = new TextDecoder();
  const file = await Deno.open(filename);
  const fileNew = await Deno.open(
    filename.split(".").join("_new."),
    { write: true, create: true },
  );

  //should consider parentesis
  let paren: boolean = false;

  for await (const line of readLines(file)) {
    //in local classes or inlined parentesis it will fuck up... or not
    const inc_class = line.includes("class");
    const posBefour = line.indexOf("{");
    let to_print = line;
    const format_class = () =>
      (!to_print.includes(":"))? ": " :
      (to_print[to_print.length - 1] !== ",")? ", " :
      " ";

    if (inc_class) {
      if (posBefour !== -1) {
        to_print = to_print.substr(0, posBefour) +
          format_class() + INTERFACE +
          to_print.substr(posBefour);
      } else {
        to_print = to_print + format_class() + INTERFACE;
      }
      paren = true;
    }

    const posAfter = to_print.indexOf("{");
    if (paren) {
      if (posAfter !== -1) {
        to_print = to_print.substr(0, posAfter + 1) +
          NEWLINE +
          INTERFACE_IMPL +
          to_print.substr(posAfter + 1);
        paren = false;
      }
    }

    await fileNew.write(encoder.encode(to_print + NEWLINE));
  }
};
export { StartFormating };
