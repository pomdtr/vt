# val - A Companion Cli for val.town

## Installation

```bash
# macOS / Linux
brew install pomdtr/tap/val

# Windows
scoop bucket add pomdtr https://github.com/pomdtr/scoop-bucket.git
scoop install pomdtr/sunbeam

# From source
go install github.com/pomdtr/val@latest
```

Or download the appropriate binary / package from the [releases page](https://github.com/pomdtr/val/releases/latest).

## Usage

```bash
export VALTOWN_TOKEN='<your token>' # or use the --token flag

val '@me.helloWorld()'

echo '1 + 1' | val
```
