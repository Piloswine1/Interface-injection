// import * as log from "https://deno.land/std@0.74.0/log/mod.ts"
import { readLines } from "https://deno.land/std@0.74.0/io/mod.ts";
import { walkSync } from "https://deno.land/std@0.74.0/fs/mod.ts"; //XXX: may be unstable

type AsyncPathWalk = (args: {
  dirpath: string,
  exts: string[],
  maxDepth: number,
  files: (string|number)[],
  preemptive: boolean,
  show: boolean
}) => Promise<void>;

type AsyncFormatFile = (filename: string, show: boolean) => Promise<void>

const INTERFACE = "IDisposable";
const INTERFACE_IMPL =
  "public void Dispose() {throw new NotImplementedException();}";
const NEWLINE = "\r\n";

const StartFormating: AsyncPathWalk = async ({
  dirpath,
  exts,
  maxDepth,
  files,
  preemptive,
  show
}) => {
  const match = files.length === 0 ? undefined : files.map(e => RegExp(e.toString()))
  const PromiseList: Promise<void>[] = [];
  for (const file of walkSync(dirpath, { exts, maxDepth, match })) {
    console.log("FileName: " + file.path);
    if (preemptive) {
      let buf = new Uint8Array(1);
      await Deno.read(Deno.stdin.rid, buf);
    }
    await FormatFile(file.path, show);
  }
  Promise.all(PromiseList)
    .then(() => console.log("formatting ended"))
    .catch((err) => console.log(err));
};
const FormatFile: AsyncFormatFile = async (filename, show) => {
  const encoder = new TextEncoder();
  const file = await Deno.open(filename);
  const filenameNew = filename.split(".").join("_new.")
  const fileNew = await Deno.open(
    filenameNew,
    { write: true, create: true },
  );

  //should consider parentesis
  let paren: boolean = false;

  for await (const line of readLines(file)) {
    //in local classes it will fuck up... or not
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

  if (show) {
    await Deno.copy(Deno.openSync(filenameNew), Deno.stdout);
  }
};
export { StartFormating };
