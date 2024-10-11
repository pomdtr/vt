# vt - A companion cli for val.town

## Installation

You will need to install [deno](https://deno.com/) first.

```bash
deno install -Agf jsr:@pomdtr/vt
```

## Features

```console
$ vt --help

Usage:   vt
Version: 1.11.0

Options:

  -h, --help     - Show this help.
  -V, --version  - Show the version number for this program.

Commands:

  val                         - Manage Vals.
  blob                        - Manage Blobs
  table                       - Manage sqlite tables.
  api          <url-or-path>  - Make an API request.
  completions                 - Generate shell completions.
  email                       - Send an email.
  query        <query>        - Execute a query.
  upgrade                     - Upgrade vt executable to latest or given version.
```

Run `vt completions --help` for instructions on how to enable shell completions.

## Authentication

Set the `VAL_TOWN_API_KEY` environment variable in your `~/.bashrc` or equivalent. You can generate a new one from <https://www.val.town/settings/api>.

## Upgrading vt

```bash
vt upgrade
```
