import fs from 'fs';
import type { TestReport } from './types';

export const getReport = async (reportPath: string): Promise<TestReport> => {
    const report = await fs.promises.readFile(reportPath, 'utf8');
    return JSON.parse(report);
};
