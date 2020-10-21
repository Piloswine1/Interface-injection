// import * as log from "https://deno.land/std@0.74.0/log/mod.ts"
import { readLines } from "https://deno.land/std@0.74.0/io/mod.ts";
import { walkSync } from "https://deno.land/std@0.74.0/fs/mod.ts"; //XXX: may be unstable

type AsyncPathWalk = (args: {
  dirpath: string;
  exts: string[];
  maxDepth: number;
  files: (string | number)[];
  preemptive: boolean;
  show: boolean;
  unixNewline: boolean;
}) => Promise<void>;

type AsyncFormatFile = (filename: string, show: boolean) => Promise<void>;

const S_KEY = 115
const TAB = "        "
const INTERFACE = "IDisposable";
const INTERFACE_IMPL =
  "public void Dispose() {throw new NotImplementedException();}";

let NEWLINE: "\n" | "\r\n" = "\r\n";

const StartFormating: AsyncPathWalk = async ({
  dirpath,
  exts,
  maxDepth,
  files,
  preemptive,
  show,
  unixNewline,
}) => {
  NEWLINE = (unixNewline) ? "\n" : "\r\n";
  const match = files.length === 0
    ? undefined
    : files.map((e) => RegExp(e.toString()));
  const PromiseList: Promise<void>[] = [];
  for (const file of walkSync(dirpath, { exts, maxDepth, match })) {
    console.log("FileName: " + file.path);
    if (preemptive) {
      let buf = new Uint8Array(2);
      await Deno.read(Deno.stdin.rid, buf);
      // s and enter to skip
      if (buf[0] === S_KEY) continue
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
  const filenameNew = filename.split(".").join("_new.");
  const fileNew = await Deno.open(
    filenameNew,
    { write: true, create: true },
  );

  //should consider parentesis
  let searchParen: boolean = false;

  for await (const line of readLines(file)) {
    //in local classes it will fuck up... or not
    let to_print = line;
    //cut comments from to_print and return  it
    const cut_custom = (delim: string) => {
      const pos = to_print.indexOf(delim);
      if (pos !== -1) {
        const tail = to_print.substr(pos);
        to_print = to_print.substr(0, pos);
        return tail;
      }
      return "";
    };
    const format_class = () =>
      (!to_print.includes(":"))? ": " :
      (to_print[to_print.length - 1] !== ",")? ", " :
      " ";

    const comments = cut_custom("//");
    if (to_print.includes("class")) {
      const paren = cut_custom("{");
      to_print = to_print.trimEnd();
      to_print += format_class() + INTERFACE + paren;
      searchParen = true;
    }

    if (searchParen) {
      const paren = cut_custom("{");
      if (paren) {
        to_print += paren + NEWLINE + TAB + INTERFACE_IMPL;
        searchParen = false;
      }
    }

    await fileNew.write(encoder.encode(to_print + comments + NEWLINE));
  }

  if (show) {
    const newFile = Deno.openSync(filenameNew)
    await Deno.copy(newFile, Deno.stdout);
    Deno.close(newFile.rid);
  }
  Deno.close(file.rid);
};
export { StartFormating };
