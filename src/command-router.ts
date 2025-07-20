import { ArgParser } from './arg-parser';
import { runCommand } from './command-runner';
import { buildPytestResultsExplorerCommand } from './commands/pytest-results-explorer';
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
    PYTEST_RESULTS_EXPLORER: new ArgParser(
        ['pytest-results-explorer|pre', param('reportPath')],
        'Explores pytest results from a JSON report file'
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

    if (ARG_PARSERS.PYTEST_RESULTS_EXPLORER.matches(args)) {
        const params = ARG_PARSERS.PYTEST_RESULTS_EXPLORER.getParams(args);
        return runCommand(params, buildPytestResultsExplorerCommand());
    }

    throw new Error(
        `Unknown command ${args[0]}. Run ${CONFIG.PROJECT_NAME} help for getting the list of valid commands`
    );
};
