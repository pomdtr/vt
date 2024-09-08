import { encodeHex } from "@std/encoding/hex";
import shlex from "shlex";
import { createEmphasize } from "emphasize";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";

export function getValTownApiKey() {
  const token = Deno.env.get("VAL_TOWN_API_KEY") ||
    Deno.env.get("VALTOWN_TOKEN") || Deno.env.get("valtown");
  if (!token) {
    throw new Error("VAL_TOWN_API_KEY is required");
  }

  return token;
}

export async function fetchEnv() {
  const resp = await fetchValTown("/v1/eval", {
    method: "POST",
    body: JSON.stringify({
      code: "JSON.stringify(Deno.env.toObject())",
    }),
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const env = await resp.json();
  delete env["VALTOWN_API_URL"];
  delete env["FORCE_COLOR"];

  return env;
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
    Authorization: `Bearer ${getValTownApiKey()}`,
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
  const userHash = await hash(getValTownApiKey());
  const item = localStorage.getItem(userHash);
  if (item) {
    return JSON.parse(item);
  }

  const resp = await fetchValTown("/v1/me");
  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const user = await resp.json();
  await localStorage.setItem(userHash, JSON.stringify(user));
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
  if (Deno.stdout.isTerminal() || Deno.env.get("FORCE_COLOR")) {
    const emphasize = createEmphasize();
    emphasize.register({ yaml });
    console.log(emphasize.highlight("yaml", value).value);
  } else {
    console.log(value);
  }
}

export function printTypescript(value: string) {
  if (Deno.stdout.isTerminal() || Deno.env.get("FORCE_COLOR")) {
    const emphasize = createEmphasize();
    emphasize.register({ typescript });
    console.log(emphasize.highlight("typescript", value).value);
  } else {
    console.log(value);
  }
}

export function printMarkdown(value: string) {
  if (Deno.stdout.isTerminal() || Deno.env.get("FORCE_COLOR")) {
    const emphasize = createEmphasize();
    emphasize.register({ markdown });
    console.log(emphasize.highlight("markdown", value).value);
  } else {
    console.log(value);
  }
}

export function printJson(obj: unknown) {
  if (Deno.stdout.isTerminal() || Deno.env.get("FORCE_COLOR")) {
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
