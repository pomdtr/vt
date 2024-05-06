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
import { tableCmd } from "./table.ts";
import { path } from "./deps.ts";
import * as embed from "./embed.ts";
import * as dotenv from "jsr:@std/dotenv";

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
  .description("Clone your vals to a local directory.")
  .arguments("<dir:string>")
  .action(async (_, dir) => {
    const { data: me } = await fetchValTown("/v1/me");
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
            sync: "deno run --allow-all --quiet --env ./sync.ts",
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
    const valDir = path.join(dir, "vals");
    Deno.mkdirSync(valDir, { recursive: true });

    const env = await fetchEnv();
    Deno.writeTextFileSync(path.join(dir, ".env"), dotenv.stringify(env));
    Deno.writeTextFileSync(path.join(dir, "serve.ts"), embed.serve);
    Deno.writeTextFileSync(path.join(dir, "sync.ts"), embed.sync);
    Deno.writeTextFileSync(path.join(dir, "README.md"), embed.readme);
    Deno.writeTextFileSync(path.join(dir, ".gitignore"), embed.gitignore);

    const command = new Deno.Command("deno", {
      args: ["task", "sync"],
      cwd: dir,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const { success } = command.outputSync();
    if (!success) {
      Deno.exit(1);
    }
  });

type Meta = {
  id: string;
  name: string;
  hash: string;
};

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
