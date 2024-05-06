#!/usr/bin/env -S deno run -A
import { Command, CompletionsCommand, open, Table, toText } from "./deps.ts";
import { valCmd } from "./val.ts";
import {
  fetchEnv,
  fetchValTown,
  printAsJSON,
  printCode,
  valtownToken,
} from "./lib.ts";
import { blobCmd } from "./blob.ts";
import { encodeHex } from "jsr:@std/encoding/hex";
import { tableCmd } from "./table.ts";
import { path } from "./deps.ts";
import * as embed from "./embed.ts";
import * as dotenv from "jsr:@std/dotenv";
import { existsSync } from "jsr:@std/fs/exists";

const rootCmd = new Command().name("vt").action(() => {
  rootCmd.showHelp();
});

rootCmd.command("val", valCmd);
rootCmd.command("blob", blobCmd);
rootCmd.command("table", tableCmd);

rootCmd
  .command("eval")
  .description("Eval an expression.")
  .arguments("[expression:string]")
  .option(
    "--args <args:string>",
    "Arguments to pass to the expression as JSON array."
  )
  .action(async (options, expression) => {
    if (!expression) {
      if (Deno.stdin.isTerminal()) {
        console.error("Expression is required.");
        Deno.exit(1);
      }

      expression = await toText(Deno.stdin.readable);
    }

    const { data } = await fetchValTown("/v1/eval", {
      method: "POST",
      body: JSON.stringify({
        code: expression,
        args: options.args ? JSON.parse(options.args) : undefined,
      }),
    });

    console.log(data);
  });

rootCmd
  .command("repl")
  .description("Start a REPL.")
  .action((_) => {
    const args = [
      "repl",
      "--allow-net",
      "--allow-env",
      "--reload=https://esm.town/v/",
    ];

    const { success } = new Deno.Command("deno", {
      args,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        valtown: valtownToken,
        DENO_AUTH_TOKENS: `${valtownToken}@esm.town`,
      },
    }).outputSync();

    if (!success) {
      Deno.exit(1);
    }
  });

rootCmd
  .command("api")
  .description("Make an API request.")
  .example("Get your user info", "vt api /v1/me")
  .arguments("<url-or-path:string>")
  .option("-X, --method <method:string>", "HTTP method.", { default: "GET" })
  .option("-d, --data <data:string>", "Request Body")
  .option("-H, --header <header:string>", "Request Header", { collect: true })
  .action(async ({ method, data, header }, url) => {
    const headers: Record<string, string> = {};
    for (const h of header || []) {
      const [key, value] = h.split(":", 2);
      headers[key.trim()] = value.trim();
    }

    let body: string | undefined;
    if (data == "@-") {
      body = await toText(Deno.stdin.readable);
    } else if (data) {
      body = data;
    }

    const { data: res, error } = await fetchValTown(url, {
      method,
      headers,
      body,
    });

    if (error) {
      console.error(error.message);
      Deno.exit(1);
    }

    printAsJSON(res);
  });

rootCmd
  .command("openapi")
  .description("View openapi specs")
  .hidden()
  .option("--web, -w", "Open in browser")
  .action(async ({ web }) => {
    if (web) {
      open("https://www.val.town/docs/openapi.html");
      Deno.exit(0);
    }

    const resp = await fetch("https://www.val.town/docs/openapi.yaml");
    if (resp.status != 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    printCode("yaml", await resp.text());
  });

rootCmd.command("completions", new CompletionsCommand());

rootCmd
  .command("clone")
  .description("Clone all public vals to a directory.")
  .option("-p, --private", "Include private vals.")
  .arguments("<dir:string>")
  .action(async (_, dir) => {
    const { data: me } = await fetchValTown("/v1/me");
    const { data: vals } = await fetchValTown(`/v1/users/${me.id}/vals`, {
      paginate: true,
    });

    Deno.mkdirSync(dir, { recursive: true });
    Deno.writeTextFileSync(
      path.join(dir, "deno.json"),
      JSON.stringify(
        {
          lock: false,
          unstable: ["sloppy-imports"],
          imports: {
            [`https://esm.town/v/${me.username}/`]: "./vals/",
          },
          tasks: {
            serve:
              "deno run --reload=https://esm.town --allow-read --allow-net --allow-env --quiet --env ./serve.ts",
            run: "deno run --reload=https://esm.town --allow-read --allow-net --allow-env --quiet --env",
          },
        },
        null,
        2
      )
    );

    Deno.writeTextFileSync(path.join(dir, "types.d.ts"), embed.types);
    const lock: Record<string, Meta> = {};
    const valDir = path.join(dir, "vals");
    Deno.mkdirSync(valDir, { recursive: true });
    for (const val of vals) {
      const filename = `${val.name}.tsx`;
      Deno.writeTextFileSync(path.join(valDir, filename), val.code);

      lock[filename] = {
        id: val.id,
        name: val.name,
        hash: await encodeHex(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(val.code)
          )
        ),
      };
    }

    const env = await fetchEnv();
    Deno.writeTextFileSync(path.join(dir, ".env"), dotenv.stringify(env));
    Deno.writeTextFileSync(path.join(dir, "serve.ts"), embed.serve);
    Deno.writeTextFileSync(path.join(dir, "README.md"), embed.readme);

    Deno.writeTextFileSync(
      path.join(dir, "vt.lock"),
      JSON.stringify(lock, null, 2)
    );
  });

type Meta = {
  id: string;
  name: string;
  hash: string;
};

rootCmd.command("sync").action(async () => {
  // local -> remote
  if (!existsSync("vt.lock")) {
    console.error("No lock file found.");
    Deno.exit(1);
  }

  const lock = JSON.parse(Deno.readTextFileSync("vt.lock")) as Record<
    string,
    Meta
  >;
  const files = [...Deno.readDirSync("vals")]
    .filter((f) => f.isFile && f.name.endsWith(".tsx"))
    .map((f) => f.name);
  for (const file of files) {
    const meta = lock[file];
    // val does not exist remotely, create it
    const code = Deno.readTextFileSync(`vals/${file}`);
    if (!meta) {
      if (confirm(`Create ${file} remotely?`)) {
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
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(code)
            )
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

    console.log(`Updating ${file}`);
    const { error } = await fetchValTown(`/v1/vals/${meta.id}/versions`, {
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
    if (!existsSync(`vals/${name}`)) {
      if (
        confirm(`Val ${name} was deleted. Do you want to delete it remotely?`)
      ) {
        await fetchValTown(`/v1/vals/${meta.id}`, { method: "DELETE" });
        delete lock[name];
      }
    }

    localVals[meta.id] = meta;
  }

  // remote -> local
  const { data: me } = await fetchValTown("/v1/me");
  const { data: vals } = await fetchValTown(`/v1/users/${me.id}/vals`, {
    paginate: true,
  });

  for (const val of vals) {
    const meta = localVals[val.id];
    const filename = `${val.name}.tsx`;
    const hash = await encodeHex(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val.code))
    );

    // val does not exist locally, create it
    if (!meta) {
      console.log(`Creating ${filename}`);

      const code = val.code;
      Deno.writeTextFileSync(`vals/${filename}`, code);

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
      if (confirm(`Update ${filename}?`)) {
        const {
          data: { code },
        } = await fetchValTown(`/v1/vals/${val.id}`);
        Deno.writeTextFileSync(`vals/${val.name}.tsx`, code);

        lock[`${val.name}.tsx`] = {
          ...meta,
          hash: await encodeHex(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(code)
            )
          ),
        };
      }
    }

    if (val.name != meta.name) {
      console.log(`Renaming ${meta.name}.tsx to ${val.name}.tsx`);
      Deno.rename(`vals/${meta.name}.tsx`, `vals/${val.name}.tsx`);
      lock[`${val.name}.tsx`] = {
        ...meta,
        name: val.name,
      };

      delete lock[`${meta.name}.tsx`];
    }
  }

  const remoteEnv = await fetchEnv();
  const localEnv = dotenv.parse(Deno.readTextFileSync(".env"));
  if (JSON.stringify(remoteEnv) !== JSON.stringify(localEnv)) {
    Deno.writeTextFileSync(".env", dotenv.stringify(remoteEnv));
  }

  Deno.writeTextFileSync("vt.lock", JSON.stringify(lock, null, 2));
});

rootCmd
  .command("query")
  .description("Execute a query.")
  .arguments("<query:string>")
  .action(async (_, query) => {
    const { data: res } = await fetchValTown<{
      rows: string[][];
      columns: string[];
    }>("/v1/sqlite/execute", {
      method: "POST",
      body: JSON.stringify({ statement: query }),
    });

    if (!Deno.stdout.isTerminal()) {
      console.log(res.rows.map((row) => row.join("\t")).join("\n"));
      return;
    }

    const table = new Table(...res.rows).header(res.columns);
    table.render();
  });

await rootCmd.parse();
