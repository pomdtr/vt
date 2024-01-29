import { emphasize, shlex } from "./deps.ts";

export const valtownToken = Deno.env.get("VALTOWN_TOKEN") || "";
if (!valtownToken) {
  console.error("VALTOWN_TOKEN is required");
  Deno.exit(1);
}

export function fetchValTown(path: string, init?: RequestInit) {
  return fetch(`https://api.val.town${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${valtownToken}`,
    },
  });
}

export function splitVal(val: string) {
  if (val.startsWith("@")) {
    val = val.slice(1);
  }

  const [author, name] = val.split(/[.\/]/);
  return { author, name };
}

export async function editText(text: string, extension: string) {
  const tempfile = await Deno.makeTempFile({
    suffix: `.${extension}`,
  });
  await Deno.writeTextFile(tempfile, text);
  const editor = Deno.env.get("EDITOR") || "vim";
  const [name, ...args] = [...shlex.split(editor), tempfile];

  const command = new Deno.Command(name, {
    args,
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
  });

  const { code } = await command.output();
  if (code !== 0) {
    console.error(`editor exited with code ${code}`);
    Deno.exit(1);
  }

  return Deno.readTextFile(tempfile);
}

export function printCode(language: string, value: string) {
  if (Deno.stdout.isTerminal()) {
    console.log(emphasize.highlight(language, value).value);
  } else {
    console.log(value);
  }
}

export function printAsJSON(obj: unknown) {
  if (Deno.stdout.isTerminal()) {
    console.log(
      emphasize.highlight("json", JSON.stringify(obj, null, 2)).value,
    );
  } else {
    console.log(JSON.stringify(obj));
  }
}
