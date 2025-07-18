#!/usr/bin/env bun

import inquirer from "inquirer";
import { $ } from "bun";
import highlight from "cli-highlight";
import * as readline from "node:readline";

const MAX_RESULTS = 3;

// 1. Get the function name from the script's first argument
const functionName = Bun.argv[2];

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on("keypress", (str, key) => {
  // Si la tecla es ESC (o Ctrl+C como respaldo), terminamos el script
  if (key.name === "escape" || (key.ctrl && key.name === "c")) {
    console.log("\n👋 Search aborted!");
    process.exit(0);
  }
});

if (!functionName) {
  console.error("❌ Error: You must provide a function name as an argument.");
  console.log("Usage: ./search-py-fn-implementation.ts <functionName>");
  process.exit(1);
}

try {
  // 2. Execute ripgrep (rg) to search for the function definition
  //console.log(`🔎 Searching for definitions of "${functionName}"...`);
  const rgCommand =
    $`rg -t py --line-number --regexp "def ${functionName}\\(" .`.quiet();
  // .nothrow() prevents Bun from exiting if rg fails (e.g., no matches)
  const { stdout, exitCode } = await rgCommand.nothrow();

  if (exitCode !== 0 && stdout.length === 0) {
    console.log(`🤷 No results found for "def ${functionName}(".`);
    process.exit(0);
  }

  const outputLines = stdout.toString().trim().split("\n");

  if (outputLines.length === 0 || outputLines[0] === "") {
    console.log(`🤷 No results found for "def ${functionName}(".`);
    process.exit(0);
  }

  // 3. Parse the rg output to create choices for the selector
  const choices = outputLines.map((line) => {
    const parts = line.split(":");
    const filePath = parts[0];
    const fileLine = parts[1];
    const code = parts.slice(2).join(":").trim();

    // highlight-start
    // Colorize the code snippet for display
    const coloredCode = highlight(code, {
      language: "python",
      theme: "tokyo-night-dark",
      ignoreIllegals: true,
    });
    // highlight-end

    return {
      name: `${filePath}:${fileLine}\n        ${coloredCode}`, // Text displayed to the user
      value: `${filePath}:${fileLine}`, // The actual value used upon selection
      short: `${filePath}:${fileLine}`, // Short name displayed after selection
    };
  });

  // 4. Display the interactive selector to the user
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "selection",
      message: `Select a function definition (Use ↑ and ↓, Enter to select, ESC to quit) [Total results: ${outputLines.length}]:`,
      choices: choices,
      pageSize: MAX_RESULTS * 2, // Display more options on the screen
      loop: false, // Disable the ability to loop through the options
    },
  ]);

  const selectedFile = answers.selection;

  // 5. Execute the final command with the user's selection
  console.log(`🚀 Opening ${selectedFile} with zeditor...`);
  await $`zeditor --add ${selectedFile}`;
} catch (error) {
  // Inquirer throws an error if the user aborts (e.g., by pressing Ctrl+C or ESC).
  // We can just catch it and exit gracefully.
  console.log("\n👋 Search aborted!");
  process.exit(0);
}
