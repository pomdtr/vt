import { parseArgs } from "jsr:@std/cli/parse-args";
import * as path from "jsr:@std/path";

const args = parseArgs(Deno.args, {
  string: ["port"],
});

const [valFile] = args._;
if (!valFile || typeof valFile !== "string") {
  console.error("Usage: serve-val <valFile>");
  Deno.exit(1);
}

const valPath = path.join(Deno.cwd(), valFile);
const mod = await import(valPath);

if (mod.default) {
  Deno.serve({ port: parseInt(args.port || "8000") }, mod.default);
} else {
  const exports = Object.values(mod);
  if (exports.length !== 1) {
    console.error("Expected a single export.");
    Deno.exit(1);
  }

  const handler = exports[0] as any;
  Deno.serve({ port: parseInt(args.port || "8000") }, handler);
}
