# vt - A Companion Cli for val.town

## Installation

```bash
# macOS / Linux
brew install pomdtr/tap/vt

# Windows
scoop bucket add pomdtr https://github.com/pomdtr/scoop-bucket.git
scoop install pomdtr/vt

# From source
go install github.com/pomdtr/vt@latest
```

Or download the appropriate binary / package from the [releases page](https://github.com/pomdtr/val/releases/latest).

## Usage

```bash
export VALTOWN_TOKEN='<your token>' # or use the --token flag

vt eval '@me.helloWorld()'
echo '1 + 1' | vt eval

vt run me.myApi pomdtr

vt api /alias/pomdtr
```
