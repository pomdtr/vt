import {
  Command,
  CompletionsCommand,
} from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { VALTOWN_TOKEN_ENV, apiRoot, client } from "./client.ts";
import { open } from "https://deno.land/x/open@v0.0.6/index.ts";

export function splitVal(val: string) {
  if (val.startsWith("@")) {
    val = val.slice(1);
  }

  const [author, name] = val.split(".");
  return { author, name };
}

async function editText(text: string, extension: string) {
  const tempfile = await Deno.makeTempFile({
    suffix: `.${extension}`,
  });
  await Deno.writeTextFile(tempfile, text);
  const command = new Deno.Command(editor, {
    args: [tempfile],
    stdin: "inherit",
    stderr: "inherit",
    stdout: "inherit",
  });

  const { code } = await command.output();
  if (code !== 0) {
    throw new Error("exit error");
  }

  return Deno.readTextFile(tempfile);
}

const rootCmd = new Command()
  .name("vt")
  .globalOption("-t, --token [token:string]", "Valtown API token.")
  .action(() => {
    rootCmd.showHelp();
  });

rootCmd
  .command("eval")
  .description("Eval an expression.")
  .arguments("<expression:string>")
  .action(async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV) }, expression) => {
    await client["/v1/eval"].post({
      json: {
        code: expression,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  });

rootCmd
  .command("run")
  .description("Run a val.")
  .arguments("<val:string> [args...]")
  .action(async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV) }, val, ...args) => {
    const { author, name } = splitVal(val);

    const resp = await client["/v1/run/{username}.{val_name}"].post({
      // @ts-ignore: path params extraction is broken
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
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

const editor = Deno.env.get("EDITOR") || "vim";
rootCmd
  .command("edit")
  .description("Edit a val in the system editor.")
  .arguments("<val:string>")
  .action(async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV) }, val) => {
    const { author, name } = splitVal(val);
    const getResp = await client["/v1/alias/{username}/{val_name}"].get({
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (getResp.status !== 200) {
      throw new Error();
    }

    const { code, id: valID } = await getResp.json();
    if (!code || !valID) {
      throw new Error("exit error");
    }

    const updateResp = await client["/v1/vals/{val_id}/versions"].post({
      params: {
        val_id: valID,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
      json: { code: await editText(code, "ts") },
    });

    if (updateResp.status !== 201) {
      throw new Error();
    }

    console.log("Updated!");
  });

rootCmd
  .command("open")
  .description("Open a val in the system browser.")
  .arguments("<val:string>")
  .action(async (_, val) => {
    const { author, name } = splitVal(val);

    await open(`https://val.town/v/${author}.${name}`);
  });

rootCmd
  .command("list")
  .description("List vals.")
  .option("-u, --user <user:string>", "Filter by user.")
  .action(async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV), user }) => {
    if (!user) {
      const meResp = await client["/v1/me"].get({
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (meResp.status != 200) {
        throw new Error();
      }

      const { id } = await meResp.json();
      if (!id) {
        throw new Error();
      }

      user = id;
    }

    const listResp = await client["/v1/users/{user_id}/vals"].get({
      params: {
        user_id: user,
      },
      query: {
        limit: 100,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (listResp.status != 200) {
      throw new Error();
    }

    const { data } = await listResp.json();
    if (!data) {
      throw new Error();
    }

    const table = new Table().body(
      data?.map((val) => [
        `${val.author?.username}.${val.name}`,
        val.public ? "public" : "private",
        val.version,
      ])
    );

    table.render();
  });

rootCmd
  .command("view")
  .description("View val code.")
  .arguments("<val:string>")
  .action(async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV) }, val) => {
    const { author, name } = splitVal(val);
    const resp = await client["/v1/alias/{username}/{val_name}"].get({
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (resp.status != 200) {
      throw new Error(resp.statusText);
    }

    const { code } = await resp.json();

    console.log(code);
  });

rootCmd
  .command("api")
  .arguments("<path:string>")
  .option("-X, --method <method:string>", "HTTP method.", { default: "GET" })
  .option("-d, --data <data:string>", "Request Body")
  .action(
    async ({ token = Deno.env.get(VALTOWN_TOKEN_ENV), method, data }, path) => {
      if (!path.startsWith("/")) {
        path = `/${path}`;
      }
      if (!path.startsWith("/v1")) {
        path = `/v1${path}`;
      }

      const resp = await fetch(`${apiRoot}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      if (resp.status != 200) {
        throw new Error(resp.statusText);
      }

      const body = await resp.json();
      console.log(JSON.stringify(body, null, 2));
    }
  );

rootCmd
  .command("token")
  .hidden()
  .action(({ token = Deno.env.get(VALTOWN_TOKEN_ENV) }) => {
    console.log(token);
  });

rootCmd.command("completions", new CompletionsCommand()).hidden();

await rootCmd.parse();
