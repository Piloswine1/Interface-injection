// import * as log from "https://deno.land/std@0.74.0/log/mod.ts"
import { readLines, StringWriter, StringReader } from "https://deno.land/std@0.74.0/io/mod.ts";
import { walkSync } from "https://deno.land/std@0.74.0/fs/mod.ts"; //XXX: may be unstable
import { range } from "https://unpkg.com/@newdash/newdash-deno/range.ts";
import { equal } from "https://deno.land/std@0.75.0/bytes/mod.ts";

type AsyncPathWalk = (args: {
  dirpath: string;
  exts: string[];
  maxDepth: number;
  files: (string | number)[];
  preemptive: boolean;
  show: boolean;
  unixNewline: boolean;
  fix: boolean;
}) => Promise<void>;

interface OpenFilesRet {
  self: Deno.File,
  write: (str: string) => Promise<number>,
  rid: number
}

interface OpenFilesType {
  (filename: string): Promise<[
    OpenFilesRet[], 
    (r: boolean)=>void
  ]>
} 

type AsyncFormatFile = (filename: string, show: boolean) => Promise<void>;


const encoder = new TextEncoder();

let NEWLINE: "\n" | "\r\n" = "\r\n";
let _TAB = "";

const BOM = encoder.encode("\u{feff}");
const BOM_STR = "\u{feff}";
const S_KEY = 115
const TAB = (n: number) => {
  let ret = _TAB;
  range(n).forEach(_=> ret += "\t");
  return ret;
}
const CLASS = "class "
const ABSTRACT = "abstract "
const USING ="using System;" //utf 8 - BOM
const INTERFACE = "IDisposable";
const DISPOSE_OLD = "public void Dispose() {throw new NotImplementedException();}";
const DISPOSE = "public void Dispose()";
const INTERFACE_IMPL = (n: number = 0) => {
  const TAB1 = TAB(n)
  const TAB2 = TAB1 + "\t"
  return TAB1 + DISPOSE +
    NEWLINE + TAB1 + "{" +
    NEWLINE + TAB2 + "throw new NotImplementedException();" +
    NEWLINE + TAB1 + "}";
}
// const INTERFACE_IMPL =
// "public void Dispose(){throw new NotImplementedException();" +
//  NEWLINE + TAB(2) + "}";



const StartFormating: AsyncPathWalk = async ({
  dirpath,
  exts,
  maxDepth,
  files,
  preemptive,
  show,
  unixNewline,
  fix,
}) => {
  NEWLINE = (unixNewline) ? "\n" : "\r\n";
  const match = files.length === 0
    ? undefined
    : files.map((e) => RegExp(e.toString()));
  for (const file of walkSync(dirpath, { exts, maxDepth, match })) {
    console.log("FileName: " + file.path);
    if (preemptive) {
      let buf = new Uint8Array(2);
      await Deno.read(Deno.stdin.rid, buf);
      // s and enter to skip
      if (buf[0] === S_KEY) continue
    }
    _TAB = ""
    if (fix) {
      await FixFile(file.path, show);
    } else {
      await FormatFile(file.path, show);
    }
  }
};
const OpenFiles: OpenFilesType = async (filename)  => {
  const makeObjects = (files: Deno.File[]) => files.map(e => ({
    self: e,
    write: (str: string) => e.write(encoder.encode(str)),
    rid: e.rid
  }))

  const file = await Deno.open(filename, {read: true, write: false});
  const newFilename = filename.split(".").join("_new.")
  const fileNew = await Deno.open(
    newFilename,
    { write: true, read:true, create: true },
  );

  const cleanUp = (r: boolean = false) => {
    Deno.close(file.rid);
    Deno.close(fileNew.rid);
    if (r) Deno.removeSync(newFilename);
  }

  const files = makeObjects([file,fileNew])
  return [files, cleanUp]
}

type CB = (s: string)=>void

//UTILS___________________________________________
const copyFileTo = async (from: OpenFilesRet, to: Deno.Writer) => {
  await Deno.seek(from.rid, 0, Deno.SeekMode.Start);
  await Deno.copy(from.self, to);  
}

const format_class = (str: string, cb: CB) => {
  str = str.trimEnd();
  cb(str);
  return ({
    isDotted: str.includes(":"),
    isComma: str[str.length - 1] === ","
  });
};

const cut_custom = (str: string, delim: string, cb: CB) => {
  const pos = str.indexOf(delim);
  let tail = ""
  if (pos !== -1) {
    tail = str.substr(pos);
    str = str.substr(0, pos);
  }
  cb(str)
  return tail;
};

const count_parent = (str: string) => {
  const opened = str.match("{");
  const closed = str.match("}");
  const num = (opened?.length ?? 0) - (closed?.length ?? 0)
  return {
    opened: opened?.length,
    closed: closed?.length,
    num
  }
}
//________________________________________________

/**
 * @param filename 
 * @param show 
 */
const FixFile_OLD: AsyncFormatFile = async (filename, show) => {
  const [[file, fileNew], cleanUp] = await OpenFiles(filename);

  let _interface = false,
    _dispose = false,
    _using = false;

  for await (const line of readLines(file.self)) {
    if (line.includes(USING)) _using = true;
    if (line.includes(INTERFACE)) _interface = true;
    if (line.includes(DISPOSE)) _dispose = true;
  }

  if (_interface && _dispose) {
    if (_using) {
      console.log("not fixing");
    } else {
      console.error("no using");
    }
    cleanUp(true);
    return
  }

  await Deno.seek(file.rid, 0, Deno.SeekMode.Start);

  for await (const line of readLines(file.self)) {  
    let to_print = line.trimEnd();  
    let cb = (str: string) => {to_print = str};

    const comments = cut_custom(to_print, "//", cb);

    if (to_print.includes(CLASS)      && 
        !to_print.includes(INTERFACE) &&
        !to_print.includes(ABSTRACT)) {
      const paren = cut_custom(to_print, "{", cb);
      const {isComma, isDotted} = format_class(to_print, cb);
      if (!isDotted) {
        to_print += ":";
      } else if (!isComma) {
        to_print += ",";
      }
      to_print += " " + INTERFACE;
      if (isComma) to_print += ","
      to_print += paren;
    }

    to_print = to_print + comments + NEWLINE;

    await fileNew.write(to_print);
  }

  if (show) await copyFileTo(fileNew, Deno.stdout);
  cleanUp(false);
  console.log("fixed");
}

const FixFile_BOM: AsyncFormatFile = async (filename, show) => {
  const [[file, fileNew], cleanUp] = await OpenFiles(filename);

  let changing = false;
  let first = true;

  for await (const _line of readLines(file.self)) {
    let line = _line.trimEnd();
    if (first) {
      if (!line.includes(BOM_STR)) {
        line = BOM_STR + line;
      }
      first = false;
    } else {
      if (line.includes(BOM_STR)) {
        changing = true;
        line = line.substr(line.indexOf(BOM_STR) + BOM_STR.length);
      } 
    }
    if (line.includes(DISPOSE_OLD)) {
      line = INTERFACE_IMPL(2); 
      changing = true;
    }
    await fileNew.write(line + NEWLINE);
  }

  if (show) await copyFileTo(fileNew, Deno.stdout);
  if (changing) {
    console.log("fixed")
  } else {
    console.log("not fixing");
  }
  cleanUp(!changing);
}

const FixFile: AsyncFormatFile = async (filename, show) => {
  const [[file, fileNew], cleanUp] = await OpenFiles(filename);
  let paren: number | null = null;

  for await (const _line of readLines(file.self)) {
    const line =  _line.trimEnd()
    const {num, opened} = count_parent(line);
    if (opened && paren === null) paren = 0;
    if (paren !== null) paren += num;
    await fileNew.write(line + NEWLINE);
    if (paren === 0) break;
  }

  if (show) await copyFileTo(fileNew, Deno.stdout);
    console.log("fixed")
  cleanUp(false);
}

/**
 * @param file - file to fix
 */
const FixUsing = async (file: OpenFilesRet) => {
  const pos = await Deno.seek(file.rid, 0, Deno.SeekMode.Current);
  await Deno.seek(file.rid, 0, Deno.SeekMode.Start);

  let changing = false;

  for await (const line of readLines(file.self)) {
    if (line.includes(USING)) break;
    if (line.includes(INTERFACE)) {
      changing = true;
      break;
    }
  }

  if (changing) {
    await Deno.seek(file.rid, 0, Deno.SeekMode.Start);
    const buf = new StringWriter();

    const to_BOM = new Uint8Array(3)
    await file.self.read(to_BOM);
    if (!equal(to_BOM, BOM))
      await Deno.seek(file.rid, 0, Deno.SeekMode.Start);

    await Deno.copy(file.self, buf);
    const buf_r = new StringReader(buf.toString())
    await Deno.seek(file.rid, 0, Deno.SeekMode.Start);
    await file.self.write(BOM);
    await file.write(USING + NEWLINE);
    await Deno.copy(buf_r, file.self);

    console.log("fixed");
  } else {
    console.log("not changing");
  }

  await Deno.seek(file.rid, pos, Deno.SeekMode.Start);
}

const FormatFile: AsyncFormatFile = async (filename, show) => {
  const [[file, fileNew], cleanUp] = await OpenFiles(filename);

  //should consider parentesis
  let openedParent: number | null = null;
  let firtstLine = true;

  for await (const line of readLines(file.self)) {
    //in local classes it will fuck up... or not
    let to_print = line.trimEnd();
    //cut comments from to_print and return  it
    let cb = (str: string) => {to_print = str};

    const {num, opened, closed} = count_parent(to_print);

    if (opened && opened !== 0) range(opened).forEach(_ => _TAB += "\t");
    if (closed && closed !== 0) _TAB = _TAB.substr(0, _TAB.length - closed);
    // console.log({_TAB, num, opened, closed, openedParent});

    const comments = cut_custom(to_print, "//", cb);
    if (to_print.includes(CLASS)      && 
        !to_print.includes(INTERFACE) &&
        !to_print.includes(ABSTRACT)) {
      const paren = cut_custom(to_print, "{", cb);
      const {isComma, isDotted} = format_class(to_print, cb);
      if (!isDotted) {
        to_print += ":";
      } else if (!isComma) {
        to_print += ",";
      }
      to_print += " " + INTERFACE;
      if (isComma) to_print += ","
      to_print += paren;
      openedParent = 0;
    }

    if (openedParent !== null) {
      openedParent += num
      if (closed && openedParent === 0) {
        const paren = cut_custom(to_print, "}", cb);
        to_print = to_print.trimEnd();
        to_print += NEWLINE + INTERFACE_IMPL((paren)?1:0) + 
                    NEWLINE + _TAB + paren;
        openedParent = null;
      }
    }

    if (firtstLine) {
      to_print = to_print + comments;
      firtstLine = false;
    } else {
      to_print = NEWLINE + to_print + comments;
    }
    await fileNew.write(to_print);
  }

  if (show) await copyFileTo(fileNew, Deno.stdout);

  await FixUsing(fileNew);
  cleanUp(false);
};

export { StartFormating };
