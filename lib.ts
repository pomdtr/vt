import { encodeHex } from "@std/encoding/hex";
import * as path from "@std/path";
import * as fs from "@std/fs";
import shlex from "shlex";
import { createEmphasize } from "emphasize";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";

export const valtownToken = Deno.env.get("VALTOWN_TOKEN") || "";
if (!valtownToken) {
  console.error("VALTOWN_TOKEN is required");
  Deno.exit(1);
}

export async function fetchValTown(
  path: string,
  options?: RequestInit & {
    paginate?: boolean;
  },
): Promise<Response> {
  const apiURL = Deno.env.get("VALTOWN_API_URL") || "https://api.val.town";
  const headers = {
    ...options?.headers,
    Authorization: `Bearer ${valtownToken}`,
  };
  if (options?.paginate) {
    const data = [];
    let url = new URL(`${apiURL}${path}`);
    url.searchParams.set("limit", "100");

    while (true) {
      const resp = await fetch(url, {
        headers,
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }

      const res = await resp.json();
      data.push(...res.data);

      if (!res.links.next) {
        break;
      }

      url = new URL(res.links.next);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return await fetch(`${apiURL}${path}`, {
    ...options,
    headers,
  });
}

async function hash(msg: string) {
  const data = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return encodeHex(hashBuffer);
}

export async function loadUser() {
  const cachePath = path.join(
    Deno.env.get("XDG_CACHE_HOME") ||
      path.join(Deno.env.get("HOME")!, ".cache"),
    "smallweb",
    "vt",
    "user",
    await hash(valtownToken),
  );
  if (fs.existsSync(cachePath)) {
    const text = await Deno.readTextFile(cachePath);
    return JSON.parse(text);
  }

  const resp = await fetchValTown("/v1/me");
  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const user = await resp.json();
  await Deno.mkdir(path.dirname(cachePath), { recursive: true });
  await Deno.writeTextFile(cachePath, JSON.stringify(user));
  return user;
}

export async function parseVal(val: string) {
  if (val.startsWith("@")) {
    val = val.slice(1);
  }

  const parts = val.split(/[.\/]/);
  if (parts.length == 1) {
    const user = await loadUser();
    return {
      author: user.username,
      name: val,
    };
  } else if (parts.length == 2) {
    return {
      author: parts[0],
      name: parts[1],
    };
  }

  throw new Error("invalid val");
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

export function printYaml(value: string) {
  if (Deno.stdout.isTerminal()) {
    const emphasize = createEmphasize();
    emphasize.register({ yaml });
    console.log(emphasize.highlight("yaml", value).value);
  } else {
    console.log(value);
  }
}

export function printTypescript(value: string) {
  if (Deno.stdout.isTerminal()) {
    const emphasize = createEmphasize();
    emphasize.register({ typescript });
    console.log(emphasize.highlight("typescript", value).value);
  } else {
    console.log(value);
  }
}

export function printMarkdown(value: string) {
  if (Deno.stdout.isTerminal()) {
    const emphasize = createEmphasize();
    emphasize.register({ markdown });
    console.log(emphasize.highlight("markdown", value).value);
  } else {
    console.log(value);
  }
}

export function printJson(obj: unknown) {
  if (Deno.stdout.isTerminal()) {
    const emphasize = createEmphasize();
    emphasize.register({
      json,
    });
    console.log(
      emphasize.highlight("json", JSON.stringify(obj, null, 2)).value,
    );
  } else {
    console.log(JSON.stringify(obj));
  }
}
