import inquirer from 'inquirer';
import { $ } from 'bun';
import highlight from 'cli-highlight';
import * as readline from 'node:readline';
import type { Command } from '../types/command';

export const buildSearchPyFnDeclarationsCommand = (): Command => {
    const MAX_RESULTS = 3;

    const onExecute = async (params: any) => {
        const { functionName } = params;

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        const noDeclarationsFoundMsg = `🤷 No declarations found for "${functionName}". Maybe the file is listed in the .gitignore.`;

        const rgCommand = $`rg -t py --line-number --regexp "def ${functionName}\\(" .`.quiet();
        // .nothrow() prevents Bun from exiting if rg fails (e.g., no matches)
        const { stdout, exitCode } = await rgCommand.nothrow();

        if (exitCode !== 0 && stdout.length === 0) {
            console.log(noDeclarationsFoundMsg);
            return;
        }

        const outputLines = stdout.toString().trim().split('\n');

        if (outputLines.length === 0 || outputLines[0] === '') {
            console.log(noDeclarationsFoundMsg);
            return;
        }

        const choices = outputLines.map((line) => {
            const parts = line.split(':');
            const filePath = parts[0];
            const fileLine = parts[1];
            const code = parts.slice(2).join(':').trim();

            // highlight-start
            // Colorize the code snippet for display
            const coloredCode = highlight(code, {
                language: 'python',
                theme: 'tokyo-night-dark',
                ignoreIllegals: true,
            });
            // highlight-end

            return {
                name: `${filePath}:${fileLine}\n        ${coloredCode}`, // Text displayed to the user
                value: `${filePath}:${fileLine}`, // The actual value used upon selection
                short: `${filePath}:${fileLine}`, // Short name displayed after selection
            };
        });

        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'selection',
                message: `Select a function definition (Use ↑ and ↓, Enter to select, ESC to quit) [Total results: ${outputLines.length}]:`,
                choices: choices,
                pageSize: MAX_RESULTS * 2, // Display more options on the screen
                loop: false, // Disable the ability to loop through the options
            },
        ]);

        const selectedFile = answers.selection;

        console.log(`🚀 Opening ${selectedFile} with Zed...`);
        await $`zeditor --add ${selectedFile}`;
    };

    const onAbort = async () => {
        console.log('\n👋 Search aborted!');
    };

    return {
        onExecute,
        onAbort,
    };
};
