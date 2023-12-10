#!/usr/bin/env -S deno run -A
import {
  Command,
  CompletionsCommand,
} from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { open } from "https://deno.land/x/open@v0.0.6/index.ts";
import { valCmd } from "./val.ts";
import { fetchValTown, printAsJSON, printCode, splitVal } from "./lib.ts";
import { blobCmd } from "./blob.ts";
import { sqliteCmd } from "./sqlite.ts";
import { toText } from "https://deno.land/std@0.203.0/streams/mod.ts";

const rootCmd = new Command().name("vt").action(() => {
  rootCmd.showHelp();
});

rootCmd.command("val", valCmd);
rootCmd.command("blob", blobCmd);
rootCmd.command("sqlite", sqliteCmd);

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
  .command("run")
  .description("Run a val.")
  .hidden()
  .arguments("<val:string> [args...]")
  .action(async (_, val, ...args) => {
    const { author, name } = splitVal(val);

    let runArgs: string[] | null = null;
    if (!Deno.isatty(Deno.stdin.rid)) {
      const content = await toText(Deno.stdin.readable);
      if (content) {
        if (args.length > 0) {
          console.error(
            "val input cannot be passed both through stdin and args"
          );
          Deno.exit(1);
        }
        runArgs = JSON.parse(content);
      }
    }

    if (!runArgs) {
      runArgs = args.map((arg) => {
        try {
          return JSON.parse(arg);
        } catch {
          return arg;
        }
      });
    }

    const resp = await fetchValTown(`/v1/run/${author}.${name}`, {
      body: JSON.stringify({
        args: runArgs,
      }),
    });

    if (resp.status !== 200) {
      const res = await resp.json();
      console.error(res);
      Deno.exit(1);
    }

    const body = await resp.json();
    printAsJSON(body);
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

await rootCmd.parse();
