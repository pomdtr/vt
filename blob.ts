import { Command, Table } from "./deps.ts";
import { fetchValTown } from "./lib.ts";

export const blobCmd = new Command()
  .name("val")
  .description("Manage Blobs")
  .action(() => {
    blobCmd.showHelp();
  });

blobCmd
  .command("list")
  .alias("ls")
  .description("List blobs.")
  .option("-p, --prefix <prefix:string>", "Prefix to filter by.")
  .action(async (options) => {
    const resp = await fetchValTown(
      options.prefix
        ? `/v1/blob?prefix=${encodeURIComponent(options.prefix)}`
        : "/v1/blob",
    );
    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const blobs = (await resp.json()) as {
      key: string;
      size: number;
      lastModified: string;
    }[];
    if (!Deno.stdout.isTerminal()) {
      for (const blob of blobs) {
        console.log(`${blob.key}\t${blob.size}\t${blob.lastModified}`);
      }
      return;
    }
    const rows = blobs.map((blob) => [blob.key, blob.size, blob.lastModified]);
    const table = new Table(...rows).header(["key", "size", "lastModified"]);
    table.render();
  });

blobCmd
  .command("download")
  .description("Download a blob.")
  .arguments("<key:string> <path:string>")
  .action(async (_, key, path) => {
    const resp = await fetchValTown(`/v1/blob/${encodeURIComponent(key)}`);
    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    const blob = await resp.blob();
    if (path == "-") {
      Deno.stdout.writeSync(new Uint8Array(await blob.arrayBuffer()));
    } else {
      Deno.writeFileSync(path, new Uint8Array(await blob.arrayBuffer()));
    }
  });

blobCmd
  .command("cat")
  .description("Print a blob to stdout.")
  .arguments("<key:string>")
  .action(async (_, key) => {
    const resp = await fetchValTown(`/v1/blob/${encodeURIComponent(key)}`);
    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    Deno.writeSync(Deno.stdout.rid, new Uint8Array(await resp.arrayBuffer()));
  });

blobCmd
  .command("upload")
  .description("Upload a blob.")
  .arguments("<path:string> <key:string>")
  .action(async (_, path, key) => {
    let body: ReadableStream;
    if (path === "-") {
      body = Deno.stdin.readable;
    } else {
      const file = await Deno.open(path);
      body = file.readable;
    }

    const resp = await fetchValTown(`/v1/blob/${encodeURIComponent(key)}`, {
      method: "POST",
      body,
    });

    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }

    console.log("Uploaded!");
  });

blobCmd
  .command("delete")
  .description("Delete a blob.")
  .alias("rm")
  .arguments("<key:string>")
  .action(async (_, key) => {
    const resp = await fetchValTown(`/v1/blob/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (!resp.ok) {
      console.error(resp.statusText);
      Deno.exit(1);
    }
    console.log("Deleted!");
  });
