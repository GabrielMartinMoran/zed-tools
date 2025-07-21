import chalk from 'chalk';
// @ts-ignore: No type definitions for 'neo-blessed'
import * as blessed from 'neo-blessed';

import type { Widgets } from 'blessed';
import clipboard from 'clipboardy';
import { getTests, registerTestsChangeObserver } from './tests-state';
import { TEST_OUTCOMES, type Test } from './types';

import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { $ } from 'bun';

interface TestList extends Widgets.ListElement {
    selected: number;
}

interface UIComponents {
    screen: Widgets.Screen;
    grid: Widgets.BoxElement;
    testList: TestList;
    detailBox: Widgets.BoxElement;
    statusBar: Widgets.BoxElement;
}

const key = (keyName: string) => chalk.bold(keyName);

const WINDOW_TITLES = {
    TEST_NAVIGATOR: 'Test Navigator',
    TEST_DETAILS: 'Test Details',
};

const STATUS_BAR_MESSAGES = {
    ON_LIST: `${key(`[${WINDOW_TITLES.TEST_NAVIGATOR}]`)} ${key('↑')}/${key('↓')}: Navigate | ${key('Enter')}/${key('→')}: Focus Tesst Detail | ${key('f')}/${key('p')}/${key('s')}: Jump to Next Failed/Passed/Skipped | ${key('Ctrl+G')}: Go to Test Definition | ${key('Esc')}/${key('q')}: Exit`,
    ON_DETAIL: `${key(`[${WINDOW_TITLES.TEST_DETAILS}]`)} ${key('↑')}/${key('↓')}: Navigate | ${key('PgUp')}/${key('PgDn')}: Jump Pages | ${key('Ctrl+K')}: Copy Options | ${key('Ctrl+O')}: Open Options | ${key('Esc')}/${key('←')}: Focus List | ${key('q')}: Exit`,
    ON_COPY_MODE: `${key('[Copy Mode]')} ${key('Ctrl+O')}: Copy stdout | ${key('Ctrl+E')}: Copy stderr | ${key('Ctrl+B')}: Copy traceback | ${key('Esc')}: Exit Copy Mode`,
    ON_OPEN_MODE: `${key('[Open Mode]')} ${key('Ctrl+O')}: Open stdout | ${key('Ctrl+E')}: Open stderr | ${key('Ctrl+B')}: Open traceback | ${key('Esc')}: Exit Open Mode`,
};

const COLORS = {
    FOCUS: 'cyan',
    BLUR: 'gray',
    TITLE_TEXT: 'white',
};

const DETAIL_SECTION_TITLES = {
    TRACEBACK_AND_DIFF: '[ TRACEBACK & DIFF ]',
    STDOUT: '[ STDOUT ]',
    STDERR: '[ STDERR ]',
    SKIP_REASON: '[ SKIP REASON ]',
};

const BOX_WIDTH_CHARS_CORRECTION_OFFSET = 4;

export const renderUI = () => {
    // --- UI SETUP ---
    const screen: Widgets.Screen = blessed.screen({
        smartCSR: true,
        title: 'Pytest Results Explorer',
        fullUnicode: true,
    });
    const grid: Widgets.BoxElement = new blessed.box({ parent: screen, width: '100%', height: '100%-1' });
    const testList: TestList = blessed.list({
        parent: grid,
        width: '40%',
        height: '100%',
        border: { type: 'line' },
        style: {
            fg: 'white',
            border: { fg: COLORS.BLUR },
            selected: { bg: 'blue' },
            item: { hover: { bg: 'blue' } },
            label: { fg: COLORS.BLUR },
        },
        label: ` ${WINDOW_TITLES.TEST_NAVIGATOR} `,
        keys: true,
        vi: true,
        mouse: true,
        scrollable: true,
        scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: COLORS.BLUR } },
    });
    const detailBox: Widgets.BoxElement = blessed.box({
        parent: grid,
        width: '60%',
        height: '100%',
        left: '40%',
        border: { type: 'line' },
        label: ` ${WINDOW_TITLES.TEST_DETAILS} `,
        style: { border: { fg: COLORS.BLUR }, label: { fg: COLORS.BLUR } },
        content: 'Select a test from the list on the left.',
        scrollable: true,
        keys: true,
        vi: true,
        mouse: true,
        alwaysScroll: true,
        scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: 'cyan' } },
    });
    const statusBar: Widgets.TextElement = blessed.text({
        parent: screen,
        bottom: 0,
        width: '100%',
        height: 1,
        content: STATUS_BAR_MESSAGES.ON_LIST,
        style: { bg: 'blue' },
    });

    // --- DYNAMIC BORDER COLORS ON FOCUS ---
    for (const element of [testList, detailBox]) {
        element.on('focus', () => {
            element.style.border.fg = COLORS.FOCUS;
            element.style.label.fg = COLORS.TITLE_TEXT;
            screen.render();
        });

        element.on('blur', () => {
            element.style.border.fg = COLORS.BLUR;
            element.style.label.fg = COLORS.BLUR;
            screen.render();
        });
    }
    // Set the initial focused element's border
    // This assumes testList is the first element to get focus
    testList.style.border.fg = COLORS.FOCUS;
    testList.style.label.fg = COLORS.TITLE_TEXT;

    const uiComponents = {
        screen,
        grid,
        testList,
        detailBox,
        statusBar,
    } as UIComponents;

    setUpEvents(uiComponents);

    registerTestsChangeObserver(() => onTestsChange(uiComponents));

    screen.render();
};

export const displayTestDetails = (tests: Test[], testIndex: number, detailBox: Widgets.BoxElement) => {
    const test = tests[testIndex];
    if (!test) return;
    let outcomeText: string;
    switch (test.outcome) {
        case TEST_OUTCOMES.PASSED:
            outcomeText = chalk.green.bold(TEST_OUTCOMES.PASSED.toUpperCase());
            break;
        case TEST_OUTCOMES.FAILED:
            outcomeText = chalk.red.bold(TEST_OUTCOMES.FAILED.toUpperCase());
            break;
        case TEST_OUTCOMES.SKIPPED:
            outcomeText = chalk.yellow.bold(TEST_OUTCOMES.SKIPPED.toUpperCase());
            break;
        default:
            outcomeText = chalk.gray.bold('UNKNOWN');
            break;
    }
    let details = '';
    details += chalk.bold.cyan('Test: ') + `${test.nodeid.split('::')[1]}\n`;
    details += chalk.bold.cyan('Test ID: ') + `${test.nodeid}\n`;
    details += chalk.bold.cyan('Outcome: ') + outcomeText + '\n';
    const duration = test.call?.duration ?? test.setup.duration;
    details += chalk.bold.cyan('Duration: ') + `${duration.toFixed(4)}s\n`;
    details += chalk.gray(' ' + '─'.repeat((detailBox.width as number) - BOX_WIDTH_CHARS_CORRECTION_OFFSET) + '\n\n');
    if (test.outcome === TEST_OUTCOMES.SKIPPED) {
        details += chalk.bold.yellow(`${DETAIL_SECTION_TITLES.SKIP_REASON}\n`);
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
        details += chalk.gray(
            ' ' + '─'.repeat((detailBox.width as number) - BOX_WIDTH_CHARS_CORRECTION_OFFSET) + '\n\n'
        );
    }
    if (test.call?.stdout) {
        details += chalk.bold.yellow(`${DETAIL_SECTION_TITLES.STDOUT}\n`);
        details += chalk.gray(test.call.stdout) + '\n';
        details += chalk.gray(
            ' ' + '─'.repeat((detailBox.width as number) - BOX_WIDTH_CHARS_CORRECTION_OFFSET) + '\n\n'
        );
    }
    if (test.call?.stderr) {
        details += chalk.bold.yellow(`${DETAIL_SECTION_TITLES.STDERR}\n`);
        details += chalk.gray(test.call.stderr) + '\n';
        details += chalk.gray(
            ' ' + '─'.repeat((detailBox.width as number) - BOX_WIDTH_CHARS_CORRECTION_OFFSET) + '\n\n'
        );
    }
    if (test.outcome === TEST_OUTCOMES.FAILED && test.call?.longrepr) {
        details += chalk.bold.yellow(`${DETAIL_SECTION_TITLES.TRACEBACK_AND_DIFF}\n`);
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
    detailBox.scrollTo(0);
};

export const setUpEvents = (uiComponents: UIComponents) => {
    const { testList, detailBox, statusBar, screen } = uiComponents;

    let currentSelectedTest: Test | null = null;
    let keySequenceState = ''; // State for key chords

    const focusDetails = () => {
        detailBox.focus();
        detailBox.scrollTo(0);
        statusBar.setContent(STATUS_BAR_MESSAGES.ON_DETAIL);
        screen.render();
    };

    const focusTestList = () => {
        testList.focus();
        statusBar.setContent(STATUS_BAR_MESSAGES.ON_LIST);
        screen.render();
    };

    // --- Manejador de eventos para la lista de tests ---
    testList.on('select item', (item: string, index: number) => {
        const tests = getTests();
        currentSelectedTest = tests[index] ?? null; // Keep track of the selected test
        displayTestDetails(tests, index, detailBox);
        // Reset key sequence state when selection changes
        keySequenceState = '';
        statusBar.setContent(STATUS_BAR_MESSAGES.ON_LIST);
        screen.render();
    });

    testList.key(['right', 'enter'], () => focusDetails());
    testList.key('s', () => {
        const tests = getTests();
        const currentIndex = testList.selected;
        let nextSkippedIndex = tests.findIndex((test, i) => i > currentIndex && test.outcome === TEST_OUTCOMES.SKIPPED);
        if (nextSkippedIndex === -1) {
            nextSkippedIndex = tests.findIndex((test) => test.outcome === TEST_OUTCOMES.SKIPPED);
        }
        if (nextSkippedIndex !== -1) {
            testList.select(nextSkippedIndex);
        }
    });
    testList.key('f', () => {
        const tests = getTests();
        const currentIndex = testList.selected;
        let nextFailedIndex = tests.findIndex((test, i) => i > currentIndex && test.outcome === TEST_OUTCOMES.FAILED);
        if (nextFailedIndex === -1) {
            nextFailedIndex = tests.findIndex((test) => test.outcome === TEST_OUTCOMES.FAILED);
        }
        if (nextFailedIndex !== -1) {
            testList.select(nextFailedIndex);
        }
    });
    testList.key('p', () => {
        const tests = getTests();
        const currentIndex = testList.selected;
        let nextPassedIndex = tests.findIndex((test, i) => i > currentIndex && test.outcome === TEST_OUTCOMES.PASSED);
        if (nextPassedIndex === -1) {
            nextPassedIndex = tests.findIndex((test) => test.outcome === TEST_OUTCOMES.PASSED);
        }
        if (nextPassedIndex !== -1) {
            testList.select(nextPassedIndex);
        }
    });
    testList.key('C-g', async () => {
        const tests = getTests();
        const currentIndex = testList.selected;
        const currentSelectedTest = tests[currentIndex];
        if (!currentSelectedTest) return;
        const filePath = currentSelectedTest.nodeid.split('::')[0] + ':' + ((currentSelectedTest.lineno ?? 0) + 1);
        await $`zeditor ${filePath}`.quiet();
        return screen.destroy();
    });

    // --- Manejadores de eventos para la caja de detalles ---
    detailBox.key(['left', 'escape'], () => {
        focusTestList();
    });

    // Handle copy key sequences
    detailBox.on('keypress', (ch: any, key: any) => {
        // Si no estamos esperando la segunda tecla de la secuencia, no hacemos nada aquí
        if (keySequenceState !== 'ctrl-k') {
            return;
        }

        let textToCopy: string | undefined;
        let source = '';

        // Comprobar la segunda tecla de la secuencia
        if (key.full === 'C-o') {
            textToCopy = currentSelectedTest?.call?.stdout;
            source = 'STDOUT';
        } else if (key.full === 'C-e') {
            textToCopy = currentSelectedTest?.call?.stderr;
            source = 'STDERR';
        } else if (key.full === 'C-b') {
            const longrepr = currentSelectedTest?.call?.longrepr;
            if (longrepr) {
                textToCopy = typeof longrepr === 'string' ? longrepr : longrepr.reprcrash.message;
            }
            source = 'Traceback';
        }

        // Si se encontró un atajo válido, copiar el texto
        if (source && textToCopy) {
            clipboard.writeSync(textToCopy);
            statusBar.setContent(chalk.green.bold(`✅ ${source} copied to clipboard!`));
        } else if (source) {
            statusBar.setContent(chalk.yellow(`No ${source} to copy for this test.`));
        } else {
            statusBar.setContent(chalk.red('Copy chord cancelled.'));
        }

        // Resetear el estado y restaurar la barra de estado después de un momento
        keySequenceState = '';
        setTimeout(() => {
            statusBar.setContent(STATUS_BAR_MESSAGES.ON_COPY_MODE);
            screen.render();
        }, 1500);

        screen.render();
    });

    detailBox.key('C-k', () => {
        keySequenceState = 'ctrl-k';
        statusBar.setContent(STATUS_BAR_MESSAGES.ON_OPEN_MODE);
        screen.render();
    });

    // Handle open in editor key secuences
    detailBox.on('keypress', async (ch: any, key: any) => {
        // Si no estamos esperando la segunda tecla de la secuencia, no hacemos nada aquí
        if (keySequenceState !== 'ctrl-o') {
            return;
        }

        let textToOpen: string | undefined;
        let source = '';

        // Comprobar la segunda tecla de la secuencia
        if (key.full === 'C-o') {
            textToOpen = currentSelectedTest?.call?.stdout;
            source = 'STDOUT';
        } else if (key.full === 'C-e') {
            textToOpen = currentSelectedTest?.call?.stderr;
            source = 'STDERR';
        } else if (key.full === 'C-b') {
            const longrepr = currentSelectedTest?.call?.longrepr;
            if (longrepr) {
                textToOpen = typeof longrepr === 'string' ? longrepr : longrepr.reprcrash.message;
            }
            source = 'Traceback';
        }

        // Si se encontró un atajo válido, copiar el texto
        if (source && textToOpen) {
            const tempDir = os.tmpdir();
            const uniqueFileName = `test-output-${randomUUID()}.txt`;
            const tempFilePath = path.join(tempDir, uniqueFileName);
            fs.writeFileSync(tempFilePath, textToOpen);
            await $`zeditor  --add ${tempFilePath}`.quiet();
            statusBar.setContent(chalk.green.bold(`🚀 ${source} opened in editor!`));
        } else if (source) {
            statusBar.setContent(chalk.yellow(`No ${source} to open for this test.`));
        } else {
            statusBar.setContent(chalk.red('Open chord cancelled.'));
        }

        // Resetear el estado y restaurar la barra de estado después de un momento
        keySequenceState = '';
        setTimeout(() => {
            statusBar.setContent(STATUS_BAR_MESSAGES.ON_DETAIL);
            screen.render();
        }, 1500);

        screen.render();
    });

    // Manejador para la primera tecla de la secuencia (Ctrl+K)
    detailBox.key('C-o', () => {
        keySequenceState = 'ctrl-o';
        statusBar.setContent(STATUS_BAR_MESSAGES.ON_OPEN_MODE);
        screen.render();
    });

    detailBox.key('pageup', () => {
        detailBox.scroll(-detailBox.height as number);
        screen.render();
    });

    detailBox.key('pagedown', () => {
        detailBox.scroll(detailBox.height as number);
        screen.render();
    });

    // --- Manejadores de eventos globales ---
    screen.key(['q', 'C-c', 'C-w'], () => {
        return screen.destroy();
    });

    testList.key(['escape'], () => {
        return screen.destroy();
    });
};

const onTestsChange = (uiComponents: UIComponents) => {
    const { testList, detailBox } = uiComponents;
    const tests = getTests();
    // 1. Prepare items for the list
    const testItems = tests.map((test) => {
        let statusIcon: string;
        switch (test.outcome) {
            case TEST_OUTCOMES.PASSED:
                statusIcon = chalk.green('✓');
                break;
            case TEST_OUTCOMES.FAILED:
                statusIcon = chalk.red('✗');
                break;
            case TEST_OUTCOMES.SKIPPED:
                statusIcon = chalk.yellow('»');
                break;
            default:
                statusIcon = chalk.gray('?');
                break;
        }
        return `${statusIcon} ${test.nodeid.split('::')[1]}`;
    });
    testList.setItems(testItems);

    // 2. Handle initial state based on whether tests exist
    if (tests.length > 0) {
        testList.select(0);
        displayTestDetails(tests, 0, detailBox);
    } else {
        detailBox.setContent('No tests found in the report file.');
    }

    // 3. Set initial focus on the list
    testList.focus();
};
