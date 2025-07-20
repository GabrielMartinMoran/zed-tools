import type { Command } from './types/command';

type RunCommandArgs = {
    args: object;
    command: Command;
};

export const runCommand = async (params: any, command: Command) => {
    if (command.abortOnESC) {
        process.stdin.on('keypress', async (str, key) => {
            // Si la tecla es ESC (o Ctrl+C como respaldo), terminamos el script
            if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
                await command.onAbort();
                process.exit(0);
            }
        });
    }

    process.on('SIGINT', async () => {
        await command.onAbort();
        process.exit(0);
    });

    await command.onExecute(params);
};
