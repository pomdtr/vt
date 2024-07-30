# vt - A companion cli for val.town

## Installation

You will need to install [deno](https://deno.land/) first.

```bash
deno install -Agrf jsr:@pomdtr/vt
```

Run `vt completions --help` for instructions on how to enable shell completions.

## Upgrading

```bash
vt upgrade
```

## Authentication

Set the `VALTOWN_TOKEN` environment variable. You can generate a new one from [here](https://www.val.town/settings/api).

![Alt text](assets/authentication.png)

## Features

- Manage and Edit your vals locally
- List/Upload/Download/Delete Blobs
- Execute SQLite queries, import csv files as tables

## Usage

Run `vt --help` to get a list of all available commands.
