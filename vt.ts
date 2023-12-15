#!/usr/bin/env -S deno run -A
import {
  Command,
  CompletionsCommand,
  toText,
  Table,
  open,
  fs,
  path,
} from "./deps.ts";
import { valCmd } from "./val.ts";
import {
  fetchValTown,
  printAsJSON,
  printCode,
  splitVal,
  valtownToken,
} from "./lib.ts";
import * as cli from "./cli.ts";
import { blobCmd } from "./blob.ts";
import { tableCmd } from "./table.ts";

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
      if (Deno.isatty(Deno.stdin.rid)) {
        console.error("Expression is required.");
        Deno.exit(1);
      }

      expression = await toText(Deno.stdin.readable);
    }

    const resp = await fetchValTown("/v1/eval", {
      method: "POST",
      body: JSON.stringify({
        code: expression,
        args: options.args ? JSON.parse(options.args) : undefined,
      }),
    });

    if (resp.status !== 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const body = await resp.json();

    printAsJSON(body);
  });

rootCmd
  .command("repl")
  .arguments("[val:string]")
  .description("Start a REPL.")
  .action((_, val) => {
    const args = [
      "repl",
      "--allow-net",
      "--allow-env",
      "--reload=https://esm.town/v/",
    ];

    if (val) {
      const { author, name } = splitVal(val);
      args.push(`--eval-file=https://esm.town/v/${author}/${name}`);
    }

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
  .command("install")
  .description("Install a val.")
  .arguments("<val:string>")
  .option("-f, --force", "Overwrite existing script.")
  .option("-n, --name <name:string>", "Name of the script.")
  .action((options, val) => {
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) {
      console.error("HOME environment variable is not set.");
      Deno.exit(1);
    }

    const binDir = path.join(homeDir, ".local", "bin");
    if (!fs.existsSync(binDir)) {
      Deno.mkdirSync(binDir, { recursive: true });
    }

    const name = options.name ? options.name : splitVal(val).name;
    const scriptPath = path.join(binDir, name);
    if (fs.existsSync(scriptPath) && !options.force) {
      console.error(`${name} already exists.`);
      Deno.exit(1);
    }

    Deno.writeTextFileSync(
      scriptPath,
      `#!/bin/sh

exec vt run ${val} "$@"
`
    );
    Deno.chmodSync(scriptPath, 0o755);

    console.log(`Installed ${name} to ${scriptPath}`);
  });

rootCmd
  .command("run")
  .description("Run a val.")
  .arguments("<val:string> [args...]")
  .action(async (_, val, ...args) => {
    const { author, name } = splitVal(val);

    const input: cli.Input = {
      args,
    };
    if (!Deno.isatty(Deno.stdin.rid)) {
      input.stdin = await toText(Deno.stdin.readable);
    }

    // prettier-ignore
    const code = `(await import("https://esm.town/v/${author}/${name}")).default`
    const resp = await fetchValTown("/v1/eval", {
      method: "POST",
      body: JSON.stringify({
        // prettier-ignore
        code,
        args: [input],
      }),
    });

    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const output: cli.Output = await resp.json();
    if (typeof output === "string") {
      console.log(output);
      return;
    }

    if (output.stdout) {
      console.log(output.stdout);
    }

    if (output.stderr) {
      console.error(output.stderr);
    }

    Deno.exit(output.code || 0);
  });

rootCmd
  .command("api")
  .description("Make an API request.")
  .example("Get your user info", "vt api /v1/me")
  .arguments("<path:string>")
  .option("-X, --method <method:string>", "HTTP method.", { default: "GET" })
  .option("-d, --data <data:string>", "Request Body")
  .action(async ({ method, data }, path) => {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }
    if (!path.startsWith("/v1")) {
      path = `/v1${path}`;
    }

    const resp = await fetchValTown(path, {
      method,
      body: data,
    });

    if (resp.status != 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    printAsJSON(await resp.json());
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
  .command("query")
  .description("Execute a query.")
  .arguments("<query:string>")
  .action(async (_, query) => {
    const res = await fetchValTown("/v1/sqlite/execute", {
      method: "POST",
      body: JSON.stringify({ statement: query }),
    });

    if (!res.ok) {
      console.error(res.statusText);
      Deno.exit(1);
    }

    const body = (await res.json()) as {
      columns: string[];
      rows: string[][];
    };

    if (!Deno.isatty(Deno.stdout.rid)) {
      console.log(body.rows.map((row) => row.join("\t")).join("\n"));
      return;
    }

    const table = new Table(...body.rows).header(body.columns);
    table.render();
  });

await rootCmd.parse();
