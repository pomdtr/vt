import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import {
  valtownToken,
  editText,
  fetchValTown,
  printAsJSON,
  printCode,
  splitVal,
} from "./lib.ts";
import * as path from "https://deno.land/std@0.186.0/path/mod.ts";
import { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.2/table/mod.ts";

type Val = {
  name: string;
  author: {
    username: string;
  };
  version: number;
};

export const valCmd = new Command()
  .name("val")
  .description("Manage Vals.")
  .action(() => {
    valCmd.showHelp();
  });

valCmd
  .command("edit")
  .description("Edit a val in the system editor.")
  .option("--privacy <privacy:string>", "Privacy of the val", {
    standalone: true,
  })
  .option("--name <name:string>", "Name of the val", { standalone: true })
  .arguments("<val:string>")
  .action(async (options, val) => {
    const { author, name } = splitVal(val);
    const getResp = await fetchValTown(`/v1/alias/${author}/${name}`);

    if (getResp.status !== 200) {
      console.error(getResp.statusText);
      Deno.exit(1);
    }

    const { code, id: valID, privacy } = await getResp.json();

    if (options.privacy || options.name) {
      if (privacy === options.privacy) {
        console.error("No privacy changes.");
        return;
      }

      if (name === options.name) {
        console.error("No name changes.");
        return;
      }

      const resp = await fetchValTown(`/v1/vals/${valID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ privacy: options.privacy, name: options.name }),
      });

      if (!resp.ok) {
        console.error(await resp.json());
        Deno.exit(1);
      }

      console.log("Updated!");
      return;
    }

    const edited = await editText(code, "ts");
    if (code === edited) {
      console.log("No changes.");
      return;
    }

    const updateResp = await fetchValTown(`/v1/vals/${valID}/versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: edited }),
    });

    if (updateResp.status !== 201) {
      console.error(updateResp.statusText);
      Deno.exit(1);
    }

    console.log("Updated!");
  });

valCmd
  .command("view")
  .description("View val code.")
  .option("-w, --web", "View in browser")
  .option("--readme", "View readme")
  .option("--code", "View code")
  .option("--json", "View as JSON")
  .arguments("<val:string>")
  .action(async (flags, val) => {
    const { author, name } = splitVal(val);
    if (flags.web) {
      open(`https://val.town/v/${author}.${name}`);
      Deno.exit(0);
    }

    const resp = await fetchValTown(`/v1/alias/${author}/${name}`);

    if (resp.status != 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const body = await resp.json();

    if (flags.json) {
      printAsJSON(body);
      Deno.exit(0);
    }

    const { readme, code } = body;

    if (flags.readme) {
      printCode("markdown", readme || "");
      return;
    }

    if (flags.code) {
      // @ts-ignore: strange fets issue
      printCode("typescript", code);
      return;
    }

    if (Deno.isatty(Deno.stdout.rid)) {
      // @ts-ignore: strange fets issue
      printCode("typescript", code);
    } else {
      console.log(JSON.stringify(body));
    }
  });

valCmd
  .command("search")
  .description("Search vals.")
  .arguments("<query:string>")
  .action(async (_, query) => {
    const resp = await fetchValTown(
      `/v1/search/vals?query=${encodeURIComponent(query)}&limit=100`
    );
    const { data } = await resp.json();
    if (!data) {
      console.error("invalid response");
      Deno.exit(1);
    }
    const rows = data.map((val: Val) => {
      const name = `${val.author?.username}.${val.name}`;
      const link = `https://val.town/v/${name.slice(1)}`;
      return [name, `v${val.version}`, link];
    }) as string[][];

    if (Deno.isatty(Deno.stdout.rid)) {
      const table = new Table(...rows).header(["name", "version", "link"]);
      table.render();
    } else {
      console.log(rows.map((row) => row.join("\t")).join("\n"));
    }
  });

valCmd
  .command("serve")
  .description("Serve a val.")
  .option("-p, --port <port:number>", "Port to serve on", { default: 8080 })
  .option("-h, --hostname <host:string>", "Host to serve on", {
    default: "localhost",
  })
  .arguments("<val:string>")
  .action(async (options, val) => {
    const script = await valScript(val, options);
    const tempfile = await Deno.makeTempFile({
      suffix: ".ts",
    });
    Deno.writeTextFileSync(tempfile, script);
    const { success } = new Deno.Command("deno", {
      args: ["run", "--allow-env", "--allow-net", "--reload", tempfile],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        DENO_AUTH_TOKENS: `${valtownToken}@esm.town`,
      },
    }).outputSync();

    Deno.removeSync(tempfile);
    if (!success) {
      Deno.exit(1);
    }
  });

async function valScript(
  slug: string,
  options: { port: number; hostname: string }
) {
  const { author, name } = splitVal(slug);
  const esmUrl = `https://esm.town/v/${author}/${name}`;
  const exports = await import(esmUrl);

  if (exports.default) {
    return `import server from "${esmUrl}";\nDeno.serve({port: ${options.port}, hostname: "${options.hostname}"}, server);`;
  } else if (Object.keys(exports).length === 1) {
    return `import {${
      Object.keys(exports)[0]
    }} from "https://esm.town/v/${author}/${name}";\nDeno.serve({port: ${
      options.port
    }, hostname: "${options.hostname}"}, ${Object.keys(exports)[0]});`;
  } else {
    console.error("val must have a default export or a single named export");
    Deno.exit(1);
  }
}

valCmd
  .command("clone")
  .description("Clone a val.")
  .arguments("<val:string> [filepath:string]")
  .action(async (_, val, filepath) => {
    const { author, name } = splitVal(val);
    const resp = await fetchValTown(`/v1/alias/${author}/${name}`);

    if (resp.status !== 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const { code } = await resp.json();
    await Deno.writeTextFile(filepath || `${name}.ts`, code);
  });

valCmd
  .command("pull")
  .description("Pull a val.")
  .option("--remote <val:string>", "Val to pull")
  .arguments("<filepath:string>")
  .action(async (options, filepath) => {
    if (options.remote) {
      const { author, name } = splitVal(options.remote);
      const resp = await fetchValTown(`/v1/alias/${author}/${name}`);
      if (resp.status !== 200) {
        console.error(resp.statusText);
        Deno.exit(1);
      }

      const { code, version } = await resp.json();
      await Deno.writeTextFile(filepath, code);
      console.log("Pulled version", version);
      return;
    }
    const me = await fetchValTown("/v1/me");
    if (!me.ok) {
      console.error(me.statusText);
      Deno.exit(1);
    }
    const data = await me.json();
    const username = data.username.slice(1);
    const name = path.parse(filepath).name;
    const resp = await fetchValTown(`/v1/alias/${username}/${name}`);

    if (resp.status !== 200) {
      console.error(resp.statusText);
      Deno.exit(1);
    }
    const { code, version } = await resp.json();
    await Deno.writeTextFile(filepath, code);
    console.log("Pulled version", version);
  });

valCmd
  .command("push")
  .description("Push a file to Val Town.")
  .arguments("<filepath:string>")
  .action(async (_, filepath) => {
    const me = await fetchValTown("/v1/me");
    if (!me.ok) {
      console.error(me.statusText);
      Deno.exit(1);
    }
    const data = await me.json();
    const username = data.username.slice(1);

    const name = path.parse(filepath).name;
    const resp = await fetchValTown(`/v1/alias/${username}/${name}`);
    if (resp.status == 200) {
      const { id } = await resp.json();
      const updateResp = await fetchValTown(`/v1/vals/${id}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: Deno.readTextFileSync(filepath) }),
      });

      if (updateResp.status !== 201) {
        console.error(updateResp.statusText);
        Deno.exit(1);
      }

      console.log("Pushed!");
    } else if (resp.status == 404) {
      const resp = await fetchValTown(`/v1/vals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code: Deno.readTextFileSync(filepath),
        }),
      });

      if (resp.status !== 201) {
        console.error(resp.statusText);
        Deno.exit(1);
      }

      console.log("Pushed!");
    } else {
      console.error(resp.statusText);
      Deno.exit(1);
    }
  });
