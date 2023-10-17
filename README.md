# vt - A companion cli for val.town

## Installation

You will need to install [deno](https://deno.land/) first.

```bash
deno install -A http://deno.land/x/vt_cli/vt.ts
```

## Authentication

Set the `VALTOWN_TOKEN` environment variable. You can generate a new one from [here](https://www.val.town/settings/api).

![Alt text](assets/authentication.png)

## Usage

- `vt eval <expression>` : Eval an expression.
- `vt run <val> [args...]` : Run a val.
- `vt edit <val>` : Edit a val in the system editor.
- `vt open <val>` : Open a val in the system browser.
- `vt view <val>` : View val code.
- `vt search <query>` : Search for vals.
- `vt api <path>` : Make an API request.
