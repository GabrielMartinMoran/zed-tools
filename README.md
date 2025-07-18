# zed-tools

A collection of tools for Zed.

## Getting Started

To run this project, you'll need to have the following dependencies installed on your system:

- [Bun](https://bun.sh)
- [Zed](https://zed.dev/)
- [ripgrep](https://github.com/BurntSushi/ripgrep)

### Installing dependencies

To install dependencies, run:

```bash
bun install
```

### Running the project

To run the cli, execute:

```bash
./zed-tools
```

## Configuring Zed for using the tools

To configure Zed to use the tools, you'll need to add the following to your `tasks.json` file:

```jsonc
{
    "label": "Search python function declarations",
    "command": "/<path>/zed-tools/zed-tools",
    "args": ["spfd", "${ZED_SYMBOL}"],
    "cwd": "${ZED_WORKTREE_ROOT}",
    "use_new_terminal": false,
    "hide": "always",
}
```

And, for setting keyboard shortcuts up, add the following to your `keymap.json` file:

```jsonc
{
  "context": "Editor && extension == py",
  "bindings": {
    "shift-f12": [
      "task::Spawn",
      {
        "task_name": "Search python function declarations"
      }
    ]
  }
},
```
