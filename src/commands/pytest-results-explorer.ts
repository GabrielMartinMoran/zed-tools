import inquirer from 'inquirer';
import { $ } from 'bun';
import highlight from 'cli-highlight';
import * as readline from 'node:readline';
import type { Command } from '../types/command';

// @ts-ignore: No type definitions for 'neo-blessed'
import * as blessed from 'neo-blessed';
import chalk from 'chalk';
import * as fs from 'fs';
import type { Node } from 'typescript';

// --- DATA TYPES FROM THE JSON REPORT ---
interface TestReport {
    created: number;
    duration: number;
    exitcode: number;
    root: string;
    environment: object;
    summary: TestSummary;
    tests: Test[];
}

interface TestSummary {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
}

interface Test {
    nodeid: string;
    lineno?: number;
    outcome: 'passed' | 'failed' | 'skipped';
    keywords: string[];
    setup: TestPhase;
    call?: TestPhase;
    teardown: TestPhase;
}

interface TestPhase {
    outcome: 'passed' | 'failed' | 'skipped';
    duration: number;
    stdout?: string;
    stderr?: string;
    longrepr?: string | any;
}

export const buildPytestResultsExplorerCommand = (): Command => {
    let keepAliveInterval: NodeJS.Timeout | undefined = undefined;

    const onExecute = async (params: any) => {
        const { reportPath } = params;

        // --- UI SETUP (no changes) ---
        const screen = blessed.screen({ smartCSR: true, title: 'Pytest Test Viewer', fullUnicode: true });
        const grid = new blessed.box({ parent: screen, width: '100%', height: '100%-1' });
        const testList = blessed.list({
            parent: grid,
            width: '40%',
            height: '100%',
            border: { type: 'line' },
            style: { fg: 'white', border: { fg: 'cyan' }, selected: { bg: 'blue' }, item: { hover: { bg: 'blue' } } },
            label: ' Test Navigator ',
            keys: true,
            vi: true,
            mouse: true,
            scrollable: true,
            scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: 'cyan' } },
        });
        const detailBox = blessed.box({
            parent: grid,
            width: '60%',
            height: '100%',
            left: '40%',
            border: { type: 'line' },
            label: ' Test Details ',
            style: { border: { fg: 'cyan' } },
            content: 'Select a test from the list on the left.',
            scrollable: true,
            keys: true,
            vi: true,
            mouse: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: 'cyan' } },
        });
        const statusBar = blessed.text({
            parent: screen,
            bottom: 0,
            width: '100%',
            height: 1,
            content:
                'Arrows: Navigate | Enter/→: Focus Detail | Esc/←: Focus Nav | F/P/S: Find Failed/Passed/Skipped | Esc (in Nav): Quit',
            style: { bg: 'blue' },
        });

        // --- DYNAMIC BORDER COLORS ON FOCUS ---

        const focusColor = 'green';
        const blurColor = 'cyan';

        testList.on('focus', () => {
            testList.style.border.fg = focusColor;
            screen.render();
        });

        testList.on('blur', () => {
            testList.style.border.fg = blurColor;
            screen.render();
        });

        detailBox.on('focus', () => {
            detailBox.style.border.fg = focusColor;
            screen.render();
        });

        detailBox.on('blur', () => {
            detailBox.style.border.fg = blurColor;
            screen.render();
        });

        // Set the initial focused element's border
        // This assumes testList is the first element to get focus
        testList.style.border.fg = focusColor;

        // --- APPLICATION LOGIC (no changes) ---

        let report: TestReport;
        try {
            const fileContent = fs.readFileSync(reportPath, 'utf-8');
            report = JSON.parse(fileContent);
        } catch (error: any) {
            console.error(`Error reading or parsing the file: ${error.message}`);
            process.exit(1);
        }
        const allTests = report.tests;
        function displayTestDetails(testIndex: number) {
            const test = allTests[testIndex];
            if (!test) return;
            let outcomeText: string;
            switch (test.outcome) {
                case 'passed':
                    outcomeText = chalk.green.bold('PASSED');
                    break;
                case 'failed':
                    outcomeText = chalk.red.bold('FAILED');
                    break;
                case 'skipped':
                    outcomeText = chalk.yellow.bold('SKIPPED');
                    break;
                default:
                    outcomeText = chalk.gray.bold('UNKNOWN');
                    break;
            }
            let details = '';
            details += chalk.bold.cyan('Test ID: ') + `${test.nodeid}\n`;
            details += chalk.bold.cyan('Outcome: ') + outcomeText + '\n';
            const duration = test.call?.duration ?? test.setup.duration;
            details += chalk.bold.cyan('Duration: ') + `${duration.toFixed(4)}s\n`;
            details += chalk.dim('-------------------------------------------------\n\n');
            if (test.outcome === 'skipped') {
                details += chalk.bold.yellow('[ SKIP REASON ]\n');
                if (test.setup.longrepr && typeof test.setup.longrepr === 'string') {
                    const match = test.setup.longrepr.match(/\('(.*)', (\d+), '(.*)'\)/);
                    if (match) {
                        const [, filePath, line, reason] = match;
                        details += chalk.dim(`File: ${filePath}, Line: ${line}\n`);
                        details += chalk.white(reason) + '\n';
                    } else {
                        details += chalk.white(test.setup.longrepr) + '\n';
                    }
                }
            }
            if (test.call?.stdout) {
                details += chalk.bold.yellow('[ STDOUT ]\n');
                details += chalk.gray(test.call.stdout) + '\n';
            }
            if (test.call?.stderr) {
                details += chalk.bold.yellow('[ STDERR ]\n');
                details += chalk.gray(test.call.stderr) + '\n';
            }
            if (test.outcome === 'failed' && test.call?.longrepr) {
                details += chalk.bold.yellow('[ TRACEBACK & DIFF ]\n');
                const traceback =
                    typeof test.call.longrepr === 'string' ? test.call.longrepr : test.call.longrepr.reprcrash.message;
                const formattedTraceback = traceback
                    .split('\n')
                    .map((line: string) => {
                        if (line.startsWith('>')) return chalk.red.bold(line);
                        if (line.startsWith('E   ')) return chalk.red(line);
                        if (line.startsWith('+   ')) return chalk.green(line);
                        if (line.startsWith('-   ')) return chalk.red(line);
                        if (line.match(/^\s*@/)) return chalk.cyan(line);
                        return chalk.dim(line);
                    })
                    .join('\n');
                details += formattedTraceback + '\n';
            }
            detailBox.setContent(details);
        }

        // --- EVENT HANDLING (now placed before app start) ---
        testList.on('select item', (item, index) => {
            displayTestDetails(index);
            screen.render(); // Re-render on selection change
        });
        testList.key(['right', 'enter'], () => {
            detailBox.focus();
        });
        testList.key('s', () => {
            const currentIndex = testList.selected;
            let nextSkippedIndex = allTests.findIndex((test, i) => i > currentIndex && test.outcome === 'skipped');
            if (nextSkippedIndex === -1) {
                nextSkippedIndex = allTests.findIndex((test) => test.outcome === 'skipped');
            }
            if (nextSkippedIndex !== -1) {
                testList.select(nextSkippedIndex);
            }
        });
        testList.key('f', () => {
            const currentIndex = testList.selected;
            let nextFailedIndex = allTests.findIndex((test, i) => i > currentIndex && test.outcome === 'failed');
            if (nextFailedIndex === -1) {
                nextFailedIndex = allTests.findIndex((test) => test.outcome === 'failed');
            }
            if (nextFailedIndex !== -1) {
                testList.select(nextFailedIndex);
            }
        });
        testList.key('p', () => {
            const currentIndex = testList.selected;
            let nextPassedIndex = allTests.findIndex((test, i) => i > currentIndex && test.outcome === 'passed');
            if (nextPassedIndex === -1) {
                nextPassedIndex = allTests.findIndex((test) => test.outcome === 'passed');
            }
            if (nextPassedIndex !== -1) {
                testList.select(nextPassedIndex);
            }
        });
        detailBox.key(['left', 'escape'], () => {
            testList.focus();
        });
        screen.key(['escape', 'q', 'C-c'], () => {
            return screen.destroy();
        });

        // --- APPLICATION START (restructured) ---

        // 1. Prepare items for the list
        const testItems = allTests.map((test) => {
            let statusIcon: string;
            switch (test.outcome) {
                case 'passed':
                    statusIcon = chalk.green('✓');
                    break;
                case 'failed':
                    statusIcon = chalk.red('✗');
                    break;
                case 'skipped':
                    statusIcon = chalk.yellow('»');
                    break;
                default:
                    statusIcon = chalk.gray('?');
                    break;
            }
            return `${statusIcon} ${test.nodeid}`;
        });
        testList.setItems(testItems);

        // 2. Handle initial state based on whether tests exist
        if (allTests.length > 0) {
            testList.select(0);
            displayTestDetails(0);
        } else {
            detailBox.setContent('No tests found in the report file.');
        }

        // 3. Set initial focus on the list
        testList.focus();

        // 4. Render the screen
        screen.render();

        // HACK: Keep the process alive.
        // Prevents the script from exiting immediately after the initial render.
        keepAliveInterval = setInterval(() => {}, 1000 * 60 * 60);
    };

    const onAbort = async () => {
        clearInterval(keepAliveInterval);
    };

    return {
        onExecute,
        onAbort,
    };
};
