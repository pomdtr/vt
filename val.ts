import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { open } from "https://deno.land/x/open@v0.0.6/index.ts";
import { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.2/table/mod.ts";
import { client, valtownToken } from "./client.ts";

export function splitVal(val: string) {
  if (val.startsWith("@")) {
    val = val.slice(1);
  }

  const [author, name] = val.split(".");
  return { author, name };
}

export const valCmd = new Command().description("Manage vals.").action(() => {
  valCmd.showHelp();
});

const editor = Deno.env.get("EDITOR") || "vim";
valCmd
  .command("edit")
  .description("Edit a val in the system editor.")
  .arguments("<val:string>")
  .action(async (_, val) => {
    const { author, name } = splitVal(val);
    const getResp = await client["/v1/alias/{username}/{val_name}"].get({
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${valtownToken}`,
      },
    });

    if (getResp.status !== 200) {
      throw new Error();
    }

    const { code, id: valID } = await getResp.json();
    if (!code || !valID) {
      throw new Error("exit error");
    }

    const tempfile = await Deno.makeTempFile({
      suffix: ".ts",
    });
    await Deno.writeTextFile(tempfile, code);
    const command = new Deno.Command(editor, {
      args: [tempfile],
      stdin: "inherit",
      stderr: "inherit",
      stdout: "inherit",
    });

    const { code: exitCode } = await command.output();
    if (exitCode !== 0) {
      throw new Error("exit error");
    }

    const updated = await Deno.readTextFile(tempfile);
    const updateResp = await client["/v1/vals/{val_id}/versions"].post({
      params: {
        val_id: valID,
      },
      headers: {
        Authorization: `Bearer ${valtownToken}`,
      },
      json: {
        code: updated,
      },
    });

    if (updateResp.status !== 201) {
      throw new Error();
    }

    console.log("Updated!");
  });

valCmd
  .command("open")
  .description("Open a val in the system browser.")
  .arguments("<val:string>")
  .action(async (_, val) => {
    const { author, name } = splitVal(val);

    await open(`https://val.town/v/${author}.${name}`);
  });

valCmd
  .command("list")
  .description("List vals.")
  .option("-u, --user <user:string>", "Filter by user.")
  .action(async (options) => {
    let user = options.user;

    if (!user) {
      const meResp = await client["/v1/me"].get({
        headers: {
          Authorization: `Bearer ${valtownToken}`,
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
        Authorization: `Bearer ${valtownToken}`,
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

valCmd
  .command("view")
  .description("View val code.")
  .arguments("<val:string>")
  .action(async (_, val) => {
    const { author, name } = splitVal(val);
    const resp = await client["/v1/alias/{username}/{val_name}"].get({
      params: {
        username: author,
        val_name: name,
      },
      headers: {
        Authorization: `Bearer ${valtownToken}`,
      },
    });

    if (resp.status != 200) {
      throw new Error(resp.statusText);
    }

    const { code } = await resp.json();

    console.log(code);
  });
