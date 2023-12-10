import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { fetchValTown, printAsJSON } from "./lib.ts";
import { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.3/table/table.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

export const sqliteCmd = new Command()
  .name("sqlite")
  .description("Manage Sqlite Database")
  .action(() => {
    sqliteCmd.showHelp();
  });

sqliteCmd
  .command("exec")
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

sqliteCmd
  .command("import")
  .description("Import a table.")
  .option("--table-name <table:string>", "name of the table in the csv file")
  .option("--from-csv <file>", "create the database from a csv file")
  .option("--from-db <file>", "create the database from a sqlite file")
  .action(async (options) => {
    if (options.fromCsv && options.fromDb) {
      console.error("Only one of --from-csv or --table-name can be used.");
      Deno.exit(1);
    }

    const statements = [];
    if (options.fromCsv) {
      let tableName = options.tableName;
      if (!tableName) {
        const { name } = path.parse(options.fromCsv);
        tableName = name;
      }
      const dump = await csvDump(options.fromCsv, tableName);
      statements.push(...dump.split(";\n").slice(2, -2));
    } else if (options.fromDb) {
      if (!options.tableName) {
        console.error("table-name is required when importing from a db.");
        Deno.exit(1);
      }
      const dump = await dbDump(options.fromDb, options.tableName);
      statements.push(...dump.split(";\n").slice(2, -2));
    } else {
      console.error("Only --from-csv is supported right now.");
      Deno.exit(1);
    }

    const resp = await fetchValTown("/v1/sqlite/batch", {
      method: "POST",
      body: JSON.stringify({ statements }),
    });

    if (!resp.ok) {
      throw new Error(resp.statusText);
    }

    printAsJSON(await resp.json());
  });

async function dbDump(dbPath: string, tableName: string) {
  return runSqliteScript(dbPath, `.output stdout\n.dump ${tableName}\n`);
}

async function csvDump(csvPath: string, tableName: string) {
  const tempfile = await Deno.makeTempFile();
  try {
    return runSqliteScript(
      tempfile,
      `.mode csv\n.import ${csvPath} ${tableName}\n.output stdout\n.dump ${tableName}\n`
    );
  } catch (e) {
    throw new Error(e);
  } finally {
    await Deno.remove(tempfile);
  }
}

async function runSqliteScript(dbPath: string, script: string) {
  const process = new Deno.Command("sqlite3", {
    args: [dbPath],
    stdin: "piped",
    stderr: "piped",
    stdout: "piped",
  }).spawn();

  const writer = process.stdin.getWriter();
  writer.write(new TextEncoder().encode(script));
  writer.releaseLock();
  await process.stdin.close();

  const { stdout, stderr, success } = await process.output();

  if (!success) {
    throw new Error(new TextDecoder().decode(stderr));
  }

  return new TextDecoder().decode(stdout);
}
