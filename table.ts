import { Command } from "@cliffy/command";
import * as path from "@std/path";
import { fetchValTown, printJson } from "./lib.ts";

export const tableCmd = new Command()
  .name("table")
  .description("Manage sqlite tables.")
  .action(() => {
    tableCmd.showHelp();
  });
tableCmd
  .command("list")
  .description("List Tables")
  .action(async () => {
    const resp = await fetchValTown("/v1/sqlite/execute", {
      method: "POST",
      body: JSON.stringify({ statement: "SELECT name FROM sqlite_master" }),
    });

    if (!resp.ok) {
      throw new Error(resp.statusText);
    }

    const body = (await resp.json()) as {
      columns: string[];
      rows: string[][];
    };

    console.log(body.rows.map((row) => row[0]).join("\n"));
  });

tableCmd
  .command("delete")
  .description("Delete a table.")
  .arguments("<table:string>")
  .action(async (_, tableName) => {
    const resp = await fetchValTown("/v1/sqlite/execute", {
      method: "POST",
      body: JSON.stringify({ statement: `DROP TABLE IF EXISTS ${tableName}` }),
    });

    if (!resp.ok) {
      throw new Error(resp.statusText);
    }

    console.log("Table deleted.");
  });

tableCmd
  .command("import")
  .description("Import a table.")
  .option("--table-name <table:string>", "name of the table in the csv file")
  .option("--from-csv <file>", "create the database from a csv file", {
    conflicts: ["from-db"],
    depends: ["table-name"],
  })
  .option("--from-db <file>", "create the database from a sqlite file", {
    conflicts: ["from-csv"],
  })
  .action(async (options) => {
    if (!options.fromCsv && !options.fromDb) {
      console.error("Either --from-csv or --from-db is required.");
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

    printJson(await resp.json());
  });

function dbDump(dbPath: string, tableName: string) {
  return runSqliteScript(dbPath, `.output stdout\n.dump ${tableName}\n`);
}

async function csvDump(csvPath: string, tableName: string) {
  const tempfile = await Deno.makeTempFile();
  try {
    return runSqliteScript(
      tempfile,
      `.mode csv\n.import ${csvPath} ${tableName}\n.output stdout\n.dump ${tableName}\n`,
    );
  } catch (e) {
    throw e
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
