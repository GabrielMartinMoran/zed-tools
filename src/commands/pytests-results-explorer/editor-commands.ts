import { randomUUID } from 'crypto';
import type { Diff } from './diff-extractor';

import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

const cleanPythonContent = (pyString: string) => {
    const stringWithoutEscapedNewlines = pyString.replace(/\\n/g, '');

    let inString = false;
    let result = '';

    // 2. Now, proceed with the logic to remove spaces and real newlines outside of strings.
    for (let i = 0; i < stringWithoutEscapedNewlines.length; i++) {
        const char = stringWithoutEscapedNewlines[i];
        const prevChar = i > 0 ? stringWithoutEscapedNewlines[i - 1] : null;

        if (char === "'" && prevChar !== '\\') {
            inString = !inString;
        }

        if (inString) {
            result += char;
        } else {
            if (char !== '\n' && char !== ' ') {
                result += char;
            }
        }
    }

    // 3. NEW: Join concatenated string literals by removing the adjacent quotes.
    const finalResult = result.replace(/''/g, '');

    return finalResult;
};

const createFile = async (content: string, baseName: string): Promise<string> => {
    const tempDir = os.tmpdir();
    let filename = baseName;
    let normalizedContent = content;
    const isPythonFile = content.length > 0 && ['{', "'", '[', '('].find((x) => content.startsWith(x));
    if (isPythonFile) {
        filename += '.py';
        normalizedContent = cleanPythonContent(normalizedContent);
    }
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, normalizedContent);
    if (isPythonFile) {
        await $`ruff format ${filePath}`.quiet();
    }
    return filePath;
};

export const openDiff = async (testName: string, diff: Diff) => {
    const leftDiffFileName = `${testName}-DIFF-left`;
    const rightDiffFileName = `${testName}-DIFF-right`;
    const leftDiffFilePath = await createFile(diff.left, leftDiffFileName);
    const rightDiffFilePath = await createFile(diff.right, rightDiffFileName);
    await $`zeditor --diff ${rightDiffFilePath} ${leftDiffFilePath}`.quiet();
    setTimeout(() => {
        fs.unlinkSync(leftDiffFilePath);
        fs.unlinkSync(rightDiffFilePath);
    }, 500);
};

export const openStream = async (testName: string, stream: string, source: string) => {
    const tempDir = os.tmpdir();
    const uniqueFileName = `${testName}-${source}`;
    const tempFilePath = path.join(tempDir, uniqueFileName);
    fs.writeFileSync(tempFilePath, stream);
    await $`zeditor --diff ${tempFilePath} ${tempFilePath}`.quiet();
    setTimeout(() => {
        fs.unlinkSync(tempFilePath);
    }, 500);
};
