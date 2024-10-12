import { Command } from "@cliffy/command";
import open from "open";
import { Table } from "@cliffy/table";
import { toText } from "@std/streams";
import { loadUser, printMarkdown, printTypescript } from "./lib.ts";
import { editText, fetchValTown, parseVal, printJson } from "./lib.ts";

type Val = {
  name: string;
  author: {
    username: string;
  };
  privacy: "private" | "unlisted" | "public";
  version: number;
};

export const valCmd = new Command()
  .name("val")
  .description("Manage Vals.")
  .action(() => {
    valCmd.showHelp();
  });

valCmd
  .command("create")
  .description("Create a new val")
  .option("--privacy <privacy:string>", "privacy of the val")
  .option("--readme <readme:string>", "readme value")
  .arguments("[name:string]")
  .action(async (options, name) => {
    let code: string;
    if (Deno.stdin.isTerminal()) {
      code = await editText("", "tsx");
    } else {
      code = await toText(Deno.stdin.readable);
    }

    const resp = await fetchValTown("/v1/vals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        privacy: options.privacy,
        readme: options.readme,
        code,
      }),
    });

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    const val = await resp.json();
    console.log(
      `Created val ${val.name}, available at https://val.town/v/${val.author.username}/${val.name}`,
    );
  });

valCmd
  .command("delete")
  .description("Delete a val")
  .arguments("<val:string>")
  .action(async (_, ...args) => {
    const { author, name } = await parseVal(args[0]);

    const resp = await fetchValTown(`/v1/alias/${author}/${name}`);
    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }
    const val = await resp.json();
    await fetchValTown(`/v1/vals/${val.id}`, {
      method: "DELETE",
    });

    console.log(`Val ${author}/${name} deleted successfully`);
  });

valCmd
  .command("rename")
  .description("Rename a val")
  .arguments("<old-name> <new-name>")
  .action(async (_, oldName, newName) => {
    const { author, name } = await parseVal(oldName);

    const getResp = await fetchValTown(`/v1/alias/${author}/${name}`);
    if (!getResp.ok) {
      console.error(await getResp.text());
      Deno.exit(1);
    }
    const val = await getResp.json();

    const renameResp = await fetchValTown(`/v1/vals/${val.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newName,
      }),
    });
    if (!renameResp.ok) {
      console.error(await renameResp.text());
      Deno.exit(1);
    }

    console.log("Val rename successfully");
  });

valCmd
  .command("edit")
  .description("Edit a val in the system editor.")
  .option("--privacy <privacy:string>", "Privacy of the val")
  .option("--readme", "Edit the readme instead of the code")
  .arguments("<val:string>")
  .action(async (options, valName) => {
    const { author, name } = await parseVal(valName);
    const resp = await fetchValTown(`/v1/alias/${author}/${name}`);
    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    const val = await resp.json();
    if (options.privacy) {
      if (val.privacy === options.privacy) {
        console.error("No privacy changes.");
        return;
      }

      const resp = await fetchValTown(`/v1/vals/${val.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ privacy: options.privacy }),
      });

      if (!resp.ok) {
        console.error(await resp.text());
        Deno.exit(1);
      }

      console.log(
        `Updated val https://val.town/v/${val.author.username}/${val.name} privacy to ${options.privacy}`,
      );
      return;
    }

    if (options.readme) {
      let readme: string;
      if (Deno.stdin.isTerminal()) {
        readme = await editText(val.readme || "", "md");
      } else {
        readme = await toText(Deno.stdin.readable);
      }

      const resp = await fetchValTown(`/v1/vals/${val.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ readme }),
      });

      if (!resp.ok) {
        console.error(await resp.text());
        Deno.exit(1);
      }

      console.log(
        `Updated val https://val.town/v/${val.author.username}/${val.name} readme`,
      );
      Deno.exit(0);
    }

    let code: string;
    if (Deno.stdin.isTerminal()) {
      code = await editText(val.code, "tsx");
    } else {
      code = await toText(Deno.stdin.readable);
    }

    const versionResp = await fetchValTown(`/v1/vals/${val.id}/versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!resp.ok) {
      console.error(await versionResp.text());
      Deno.exit(1);
    }

    console.log(
      `Updated val https://val.town/v/${val.author.username}/${val.name}`,
    );
  });

valCmd
  .command("view")
  .alias("cat")
  .description("View val code.")
  .option("-w, --web", "View in browser")
  .option("--readme", "View readme")
  .option("--code", "View code")
  .option("--json", "View as JSON")
  .arguments("<val:string>")
  .action(async (flags, slug) => {
    const { author, name } = await parseVal(slug);
    if (flags.web) {
      await open(`https://val.town/v/${author}/${name}`);
      Deno.exit(0);
    }

    const resp = await fetchValTown(`/v1/alias/${author}/${name}`);
    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }
    const val = await resp.json();

    if (flags.json) {
      printJson(val);
      Deno.exit(0);
    }

    const { readme, code } = val;

    if (flags.readme) {
      printMarkdown(readme || "");
      return;
    }

    if (flags.code) {
      // @ts-ignore: strange fets issue
      printTypescript(code);
      return;
    }

    printTypescript(code);
  });

valCmd
  .command("search")
  .description("Search vals.")
  .arguments("<query:string>")
  .option("--limit <limit:number>", "Limit", {
    default: 10,
  })
  .action(async (options, query) => {
    const resp = await fetchValTown(
      `/v1/search/vals?query=${encodeURIComponent(query)
      }&limit=${options.limit}`,
      {
        paginate: true,
      },
    );

    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    const { data } = await resp.json();
    const rows = data.map((val: Val) => {
      const slug = `${val.author?.username}/${val.name}`;
      const link = `https://val.town/v/${slug}`;
      return [slug, `v${val.version}`, link];
    }) as string[][];

    if (Deno.stdout.isTerminal()) {
      const table = new Table(...rows).header(["slug", "version", "link"]);
      table.render();
    } else {
      console.log(rows.map((row) => row.join("\t")).join("\n"));
    }
  });

valCmd
  .command("list")
  .description("List user vals.")
  .option("--user <user:string>", "User")
  .option("--limit <limit:number>", "Limit", {
    default: 10,
  })
  .option("--json", "Output as JSON")
  .action(async (options) => {
    let userID: string;
    if (options.user) {
      const resp = await fetchValTown(
        `/v1/alias/${options.user}`,
      );

      if (!resp.ok) {
        console.error(await resp.text());
        Deno.exit(1);
      }

      const user = await resp.json();
      userID = user.id;
    } else {
      const user = await loadUser();
      userID = user.id;
    }

    const resp = await fetchValTown(
      `/v1/users/${userID}/vals?limit=${options.limit}`,
    );
    if (!resp.ok) {
      console.error(await resp.text());
      Deno.exit(1);
    }

    const { data } = await resp.json();
    if (!data) {
      console.error("invalid response");
      Deno.exit(1);
    }

    if (options.json) {
      printJson(data);
      Deno.exit(0);
    }

    const rows = data.map((val: Val) => {
      const slug = `${val.author?.username}/${val.name}`;
      const link = `https://val.town/v/${slug}`;
      return [slug, `v${val.version}`, link];
    }) as string[][];

    if (Deno.stdout.isTerminal()) {
      const table = new Table(...rows).header(["slug", "version", "link"]);
      table.render();
    } else {
      console.log(rows.map((row) => row.join("\t")).join("\n"));
    }
  });
