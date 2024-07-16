#!/usr/bin/env -S deno run -A
import { Command, CompletionsCommand, open, Table, toText } from "./deps.ts";
import { valCmd } from "./val.ts";
import { fetchValTown, printAsJSON, printCode, valtownToken } from "./lib.ts";
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
    "Arguments to pass to the expression as JSON array.",
  )
  .action(async (options, expression) => {
    if (!expression) {
      if (Deno.stdin.isTerminal()) {
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

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    console.log(resp);
  });

rootCmd.command("env").option("--json", "Output as JSON.")
  .description("Print environment variables.").action(
    async (options) => {
      const resp = await fetchValTown("/v1/eval", {
        method: "POST",
        body: JSON.stringify({
          code: "JSON.stringify(Deno.env.toObject())",
        }),
      });

      if (!resp.ok) {
        console.error(await resp.text());
        Deno.exit(1);
      }

      const env = await resp.json();
      delete env["VALTOWN_API_URL"];
      delete env["valtown"];

      if (options.json) {
        printAsJSON(env);
        return;
      }

      for (const [key, value] of Object.entries(env)) {
        console.log(`${key}=${value}`);
      }
    },
  );

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

    const resp = await fetchValTown(url, {
      method,
      headers,
      body,
    });

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    if (resp.headers.get("Content-Type")?.includes("application/json")) {
      return printAsJSON(await resp.json());
    }

    console.log(await resp.text());
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

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    printCode("yaml", await resp.text());
  });

rootCmd.command("completions", new CompletionsCommand());

rootCmd
  .command("email")
  .description("Send an email.")
  .option("-t, --to <to:string>", "To")
  .option("-s, --subject <subject:string>", "Subject")
  .option("-b, --body <body:string>", "Body")
  .action(async (options) => {
    const resp = await fetchValTown("/v1/email", {
      method: "POST",
      body: JSON.stringify({
        from: "pomdtr.vt@valtown.email",
        to: options.to,
        subject: options.subject,
        text: options.body,
      }),
    });

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    console.log("Email sent.");
  });

rootCmd
  .command("query")
  .description("Execute a query.")
  .arguments("<query:string>")
  .action(async (_, query) => {
    const resp = await fetchValTown("/v1/sqlite/execute", {
      method: "POST",
      body: JSON.stringify({ statement: query }),
    });

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    const res = await resp.json();
    if (!Deno.stdout.isTerminal()) {
      console.log(JSON.stringify(res));
      return;
    }

    const table = new Table(...res.rows).header(res.columns);
    table.render();
  });

await rootCmd.parse();
