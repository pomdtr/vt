import { emphasize, encodeHex, fs, path, shlex, xdg } from "./deps.ts";

export const valtownToken = Deno.env.get("VALTOWN_TOKEN") || "";
if (!valtownToken) {
  console.error("VALTOWN_TOKEN is required");
  Deno.exit(1);
}

export function fetchValTown(url: string, init?: RequestInit) {
  if (!url.startsWith("https:")) {
    url = `https://api.val.town${url}`;
  }

  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${valtownToken}`,
    },
  });
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
