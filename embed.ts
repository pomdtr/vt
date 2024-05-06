export const types = `
// deno-lint-ignore-file

declare global {
  /**
    * \`Interval\` is the first argument to a scheduled val.
    \`lastRunAt\` is useful for polling a data source *since* the last time the val ran. It is \`undefined\` on the first time the scheduled val runs.
    \`\`\`ts
    interface Interval {
        lastRunAt: Date | undefined;
    }
    \`\`\`
    */
  interface Interval {
    id: string;
    delay: number;
    author: string;
    registeredAt: Date;
    clearedAt: Date | undefined;
    lastRunAt: Date | undefined;
  }

  /**
   * \`Email\` is the first argument to an email handler val. It represents the email that triggered the val.
    \`\`\`ts
    interface Email {
        from: string,
        to: string,
        cc: string,
        bcc: string,
        subject: string | undefined,
        text: string | undefined,
        html: string | undefined,
    }
    \`\`\`
   */
  interface Email {
    from: string,
    to: string,
    cc: string,
    bcc: string,
    subject: string | undefined,
    text: string | undefined,
    html: string | undefined,
  }

  interface ParsedQs {
    [key: string]: undefined | string | string[] | ParsedQs | ParsedQs[];
  }

  namespace express {
    interface Request {
      get(name: "set-cookie"): string[] | undefined;
      get(name: string): string | undefined;
      header(name: "set-cookie"): string[] | undefined;
      header(name: string): string | undefined;
      is(type: string | string[]): string | false | null;
      protocol: string;
      secure: boolean;
      ip: string;
      ips: string[];
      subdomains: string[];
      path: string;
      hostname: string;
      host: string;
      fresh: boolean;
      stale: boolean;
      xhr: boolean;
      body: any;
      cookies: any;
      method: string;
      params: Record<string, string>;
      query: ParsedQs;
      signedCookies: any;
      originalUrl: string;
      baseUrl: string;
    }

    interface Response {
      status(code: number): this;
      send(body?: any): this;
      json(body?: any): this;
      jsonp(body?: any): this;
      type(type: string): this;
      set(field: any): this;
      set(field: string, value?: string | string[]): this;
      get(field: string): string | undefined;
      redirect(url: string): void;
      redirect(status: number, url: string): void;
      redirect(url: string, status: number): void;
      end(cb?: () => void): this;
      end(chunk: any, cb?: () => void): this;
      end(chunk: any, encoding: any, cb?: () => void): this;
    }
  }

  type JsonPrimitive = string | number | boolean | null;
  type JsonObject = { [Key in string]: JsonValue } & {
    [Key in string]?: JsonValue | undefined;
  };
  type JsonValue = JsonPrimitive | JsonObject | JsonArray;
  type JsonArray = JsonValue[] | readonly JsonValue[];
}

export {};
`.trimStart();

export const serve = `
import { parseArgs } from "jsr:@std/cli/parse-args";
import * as path from "jsr:@std/path";

const args = parseArgs(Deno.args, {
  string: ["port"],
});

const [filename] = args._;

if (typeof filename !== "string") {
  console.error("No file specified");
  Deno.exit(1);
}

const mod = await import(path.join(Deno.cwd(), filename));

let handler;
if (mod.default) {
  handler = mod.default;
} else {
  const exports = Object.values(mod);
  if (exports.length > 1) {
    console.error("Too many exports");
    Deno.exit(1);
  }

  handler = exports[0];
}

Deno.serve(
  {
    port: parseInt(args.port || "8000"),
  },
  handler
);
`.trimStart();

export const readme = `
## Usage

### Trigger a sync

\`\`\`sh
deno task sync
\`\`\`

### Start a local server

\`\`\`sh
deno task serve --port 8000 vals/<your-val>.tsx
\`\`\`

### Run a val locally

\`\`\`sh
deno task run vals/<your-val>.tsx
\`\`\`
`.trimStart();

export const sync = `
import { encodeHex } from "jsr:@std/encoding/hex";
import { existsSync } from "jsr:@std/fs/exists";
import * as dotenv from "jsr:@std/dotenv";
const valtownToken = Deno.env.get("valtown");

export async function fetchEnv() {
  const { data: res, error } = await fetchValTown("/v1/eval", {
    method: "POST",
    body: JSON.stringify({
      code: "JSON.stringify(Deno.env.toObject())",
      args: [],
    }),
  });

  if (error) {
    throw error;
  }

  return JSON.parse(res);
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
    Authorization: \`Bearer \${valtownToken}\`,
  };
  if (options?.paginate) {
    const data = [];
    let url = new URL(\`\${apiURL}\${path}\`);
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

  const resp = await fetch(\`\${apiURL}\${path}\`, {
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
type Meta = {
  id: string;
  name: string;
  hash: string;
};

let lock: Record<string, Meta> = existsSync("vt.lock") ? JSON.parse(Deno.readTextFileSync("vt.lock")) : {};
const files = [...Deno.readDirSync("vals")]
  .filter((f) => f.isFile && f.name.endsWith(".tsx"))
  .map((f) => f.name);
for (const file of files) {
  const meta = lock[file];
  // val does not exist remotely, create it
  const code = Deno.readTextFileSync(\`vals/\${file}\`);
  if (!meta) {
    if (confirm(\`Create \${file} remotely?\`)) {
      const { data } = await fetchValTown("/v1/vals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: file.slice(0, -4), code }),
      });

      lock[file] = {
        id: data.id,
        name: file.slice(0, -4),
        hash: await encodeHex(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
        ),
      };
      continue;
    }
  }

  const hash = await encodeHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
  );
  if (hash === meta.hash) {
    continue;
  }

  console.log(\`Updating \${file}\`);
  const { error } = await fetchValTown(\`/v1/vals/\${meta.id}/versions\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (error) {
    console.error(error);
    Deno.exit(1);
  }

  lock[file] = {
    ...meta,
    hash,
  };
}

const localVals: Record<string, Meta> = {};
for (const [name, meta] of Object.entries(lock)) {
  if (!existsSync(\`vals/\${name}\`)) {
    if (
      confirm(\`Val \${name} was deleted. Do you want to delete it remotely?\`)
    ) {
      await fetchValTown(\`/v1/vals/\${meta.id}\`, { method: "DELETE" });
      delete lock[name];
    }
  }

  localVals[meta.id] = meta;
}

// remote -> local
const { data: me } = await fetchValTown("/v1/me");
const { data: vals } = await fetchValTown(\`/v1/users/\${me.id}/vals\`, {
  paginate: true,
});

for (const val of vals) {
  const meta = localVals[val.id];
  const filename = \`\${val.name}.tsx\`;
  const hash = await encodeHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val.code))
  );

  // val does not exist locally, create it
  if (!meta) {
    console.log(\`Creating \${filename}\`);

    const code = val.code;
    Deno.writeTextFileSync(\`vals/\${filename}\`, code);

    lock[filename] = {
      id: val.id,
      name: val.name,
      hash: await encodeHex(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
      ),
    };
    continue;
  }

  if (hash !== meta.hash) {
    if (confirm(\`Update \${filename}?\`)) {
      const {
        data: { code },
      } = await fetchValTown(\`/v1/vals/\${val.id}\`);
      Deno.writeTextFileSync(\`vals/\${val.name}.tsx\`, code);

      lock[\`\${val.name}.tsx\`] = {
        ...meta,
        hash: await encodeHex(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))
        ),
      };
    }
  }

  if (val.name != meta.name) {
    console.log(\`Renaming \${meta.name}.tsx to \${val.name}.tsx\`);
    Deno.rename(\`vals/\${meta.name}.tsx\`, \`vals/\${val.name}.tsx\`);
    lock[\`\${val.name}.tsx\`] = {
      ...meta,
      name: val.name,
    };

    delete lock[\`\${meta.name}.tsx\`];
  }
}

const remoteEnv = await fetchEnv();
const localEnv = dotenv.parse(Deno.readTextFileSync(".env"));
if (JSON.stringify(remoteEnv) !== JSON.stringify(localEnv)) {
  Deno.writeTextFileSync(".env", dotenv.stringify(remoteEnv));
}

Deno.writeTextFileSync("vt.lock", JSON.stringify(lock, null, 2));
`.trimStart();

export const gitignore = `
.env
`.trimStart();
