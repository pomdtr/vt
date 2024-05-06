import { emphasize, encodeHex, fs, path, shlex, xdg } from "./deps.ts";

export const valtownToken = Deno.env.get("VALTOWN_TOKEN") || "";
if (!valtownToken) {
  console.error("VALTOWN_TOKEN is required");
  Deno.exit(1);
}

export async function fetchValTown<T = any>(
  path: string,
  options?: RequestInit & {
    paginate?: boolean;
  }
): Promise<{ data: T; error?: Error }> {
  const apiURL = Deno.env.get("API_URL") || "https://api.val.town";
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

    return { data } as { data: T };
  }

  const resp = await fetch(`${apiURL}${path}`, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { data: text as T, error: new Error(text) };
  }

  if (resp.headers.get("content-type")?.startsWith("application/json")) {
    const data = await resp.json();
    return { data };
  }

  const text = await resp.text();
  return { data: text } as { data: T };
}

async function hash(msg: string) {
  const data = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return encodeHex(hashBuffer);
}

export async function loadUser() {
  const cachePath = path.join(
    xdg.cache(),
    "vt",
    "user",
    await hash(valtownToken)
  );
  if (fs.existsSync(cachePath)) {
    const text = await Deno.readTextFile(cachePath);
    return JSON.parse(text);
  }

  const { data: user } = await fetchValTown("/v1/me");
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
      emphasize.highlight("json", JSON.stringify(obj, null, 2)).value
    );
  } else {
    console.log(JSON.stringify(obj));
  }
}
