import {
  Command,
  CompletionsCommand,
} from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { client, valtownToken } from "./client.ts";
import { valCmd, splitVal } from "./val.ts";

const rootCmd = new Command()
  .name("vt")
  .version("0.0.1")
  .action(() => {
    rootCmd.showHelp();
  });

rootCmd.command("val", valCmd);

rootCmd
  .command("run")
  .description("Run a val.")
  .arguments("<val:string> [args...]")
  .action(async (_, val, ...args) => {
    const { author, name } = splitVal(val);

    const resp = await client["/v1/run/{username}.{val_name}"].post({
      // @ts-ignore: path params extraction is broken
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${valtownToken}`,
      },
      json: {
        args: args.map((arg) => {
          try {
            return JSON.parse(arg);
          } catch {
            return arg;
          }
        }),
      },
    });

    if (resp.status !== 200) {
      console.error(resp.body);
      Deno.exit(1);
    }

    const body = await resp.json();
    console.log(JSON.stringify(body, null, 2));
  });

rootCmd
  .command("eval")
  .description("Eval an expression.")
  .arguments("<expression:string>")
  .action(async (_, expression) => {
    await client["/v1/eval"].post({
      json: {
        code: expression,
      },
      headers: {
        Authorization: `Bearer ${valtownToken}`,
      },
    });
  });

rootCmd
  .command("token")
  .hidden()
  .action(() => {
    console.log(valtownToken);
  });

rootCmd.command("completions", new CompletionsCommand()).hidden();

await rootCmd.parse();
