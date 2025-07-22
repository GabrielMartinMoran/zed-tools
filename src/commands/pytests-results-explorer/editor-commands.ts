import { randomUUID } from 'crypto';
import type { Diff } from './diff-extractor';

import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const openDiff = async (testName: string, diff: Diff) => {
    const tempDir = os.tmpdir();
    const leftDiffFileName = `${testName}-DIFF-left`;
    const leftDiffFilePath = path.join(tempDir, leftDiffFileName);
    fs.writeFileSync(leftDiffFilePath, diff.left);
    const rightDiffFileName = `${testName}-DIFF-right`;
    const rightDiffFilePath = path.join(tempDir, rightDiffFileName);
    fs.writeFileSync(rightDiffFilePath, diff.right);
    await $`zeditor --diff ${leftDiffFilePath} ${rightDiffFilePath}`.quiet();
    setTimeout(() => {
        fs.unlinkSync(leftDiffFilePath);
        fs.unlinkSync(rightDiffFilePath);
    }, 500);
};

export const openStream = async (testName: string, stream: string, source: string) => {
    const tempDir = os.tmpdir();
    const id = randomUUID();
    const uniqueFileName = `${testName}-${source}`;
    const tempFilePath = path.join(tempDir, uniqueFileName);
    fs.writeFileSync(tempFilePath, stream);
    await $`zeditor --diff ${tempFilePath} ${tempFilePath}`.quiet();
    setTimeout(() => {
        fs.unlinkSync(tempFilePath);
    }, 500);
};
