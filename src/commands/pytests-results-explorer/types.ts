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
    outcome: 'passed' | 'failed' | 'skipped';
    keywords: string[];
    setup: TestPhase;
    call?: TestPhase;
    teardown: TestPhase;
}

export interface TestPhase {
    outcome: 'passed' | 'failed' | 'skipped';
    duration: number;
    stdout?: string;
    stderr?: string;
    longrepr?: string | any;
}
