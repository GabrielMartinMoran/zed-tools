import { ArgParser } from './arg-parser';
import { runCommand } from './command-runner';
import { buildSearchPyFnDeclarationsCommand } from './commands/search-py-fn-implementation';
import { CONFIG } from './config';
import { style } from 'bun-style';

export const param = (name: string): string => {
    return ArgParser.param(name);
};

const ARG_PARSERS = {
    HELP: new ArgParser(['help|h'], 'Lists all available commands'),
    SEARCH_PY_FN_DECLARATIONS: new ArgParser(
        ['search-py-fn-declarations|spfd', param('functionName')],
        'Searches for Python function declarations'
    ),
};

export const routeCommand = (args: string[]) => {
    if (args.length === 0) {
        throw new Error('No arguments provided');
    }

    if (ARG_PARSERS.HELP.matches(args)) {
        console.log(style('💻 Allowed commands:', ['bold', 'black']));
        for (const parser of Object.values(ARG_PARSERS)) {
            console.log(`   ${parser.getRendered()}`);
        }
        return;
    }

    if (ARG_PARSERS.SEARCH_PY_FN_DECLARATIONS.matches(args)) {
        const params = ARG_PARSERS.SEARCH_PY_FN_DECLARATIONS.getParams(args);
        return runCommand(params, buildSearchPyFnDeclarationsCommand());
    }

    throw new Error(
        `Unknown command ${args[0]}. Run ${CONFIG.PROJECT_NAME} help for getting the list of valid commands`
    );
};
