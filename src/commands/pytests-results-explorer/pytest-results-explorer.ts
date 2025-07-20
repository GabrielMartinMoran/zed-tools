import inquirer from 'inquirer';
import highlight from 'cli-highlight';
import * as readline from 'node:readline';
import type { Command } from '../../types/command';
import clipboard from 'clipboardy';

// @ts-ignore: No type definitions for 'neo-blessed'
import * as blessed from 'neo-blessed';
import chalk from 'chalk';
import * as fs from 'fs';
import type { Node } from 'typescript';
import type { TestReport } from './types';
import { getReport } from './report-retriever';
import { setTests } from './tests-state';
import { renderUI } from './screen-handler';
import { $ } from 'bun';

// --- DATA TYPES FROM THE JSON REPORT ---

export const buildPytestResultsExplorerCommand = (): Command => {
    const onExecute = async (params: any) => {
        const { reportPath } = params;

        // --- APPLICATION LOGIC (no changes) ---
        renderUI();

        let report: TestReport;
        try {
            report = await getReport(reportPath);
        } catch (error: any) {
            console.error(`Error reading or parsing the file: ${error.message}`);
            process.exit(1);
        }
        const tests = report.tests;
        setTests(tests);

        // --- EVENT HANDLING ---

        // --- APPLICATION START (restructured) ---
        //
    };

    const onAbort = async () => {};

    return {
        onExecute,
        onAbort,
        abortOnESC: false,
    };
};
