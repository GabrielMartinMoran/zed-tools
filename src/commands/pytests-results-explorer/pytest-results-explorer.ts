import type { Command } from '../../types/command';

import type { TestReport } from './types';
import { getReport } from './report-retriever';
import { setTests } from './states/tests-state';
import { buildUI } from './screen-handler';

export const buildPytestResultsExplorerCommand = (): Command => {
    const onExecute = async (params: any) => {
        const { reportPath } = params;

        const ui = buildUI();
        ui.render();

        let report: TestReport;
        try {
            report = await getReport(reportPath);
        } catch (error: any) {
            console.error(`Error reading or parsing the file: ${error.message}`);
            process.exit(1);
        }
        const tests = report.tests;
        setTests(tests);
    };

    const onAbort = async () => {};

    return {
        onExecute,
        onAbort,
        abortOnESC: false,
    };
};
