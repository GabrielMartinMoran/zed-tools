export const TEST_OUTCOMES = {
    PASSED: 'passed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
} as const;

export interface TestReport {
    created: number;
    duration: number;
    exitcode: number;
    root: string;
    environment: object;
    summary: TestSummary;
    tests: Test[];
}

export interface TestSummary {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
}

export interface Test {
    nodeid: string;
    lineno?: number;
    outcome: (typeof TEST_OUTCOMES)[keyof typeof TEST_OUTCOMES];
    keywords: string[];
    setup: TestPhase;
    call?: TestPhase;
    teardown: TestPhase;
}

export interface TestPhase {
    outcome: (typeof TEST_OUTCOMES)[keyof typeof TEST_OUTCOMES];
    duration: number;
    stdout?: string;
    stderr?: string;
    longrepr?: string | any;
}
