
type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestResult {
    suite: string;
    name: string;
    status: TestStatus;
    duration: number;
    error?: string;
}

export interface TestSuite {
    name: string;
    tests: { name: string; fn: () => Promise<void> }[];
}

const suites: TestSuite[] = [];

export const describe = (name: string, fn: () => void) => {
    const currentSuite: TestSuite = { name, tests: [] };
    // Temporarily override 'it' to capture tests for this suite
    const originalIt = (window as any)._it_capture;
    (window as any)._it_capture = (testName: string, testFn: () => Promise<void>) => {
        currentSuite.tests.push({ name: testName, fn: testFn });
    };
    
    fn();
    
    suites.push(currentSuite);
    (window as any)._it_capture = originalIt;
};

export const it = (name: string, fn: () => Promise<void>) => {
    if ((window as any)._it_capture) {
        (window as any)._it_capture(name, fn);
    }
};

export const expect = (actual: any) => ({
    toBe: (expected: any) => {
        if (actual !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
    },
    toBeTruthy: () => {
        if (!actual) throw new Error(`Expected ${actual} to be truthy`);
    },
    toBeFalsy: () => {
        if (actual) throw new Error(`Expected ${actual} to be falsy`);
    },
    toBeGreaterThan: (expected: number) => {
        if (actual <= expected) throw new Error(`Expected ${actual} to be greater than ${expected}`);
    },
    toContain: (item: any) => {
        if (!Array.isArray(actual) || !actual.includes(item)) {
            throw new Error(`Expected array to contain ${item}`);
        }
    },
    toThrow: async (fn?: Function) => {
        // Handle async error checking if actual is a promise
        try {
            if (typeof actual === 'function') {
                await actual();
            } else if (actual instanceof Promise) {
                await actual;
            }
        } catch (e) {
            return; // It threw, so test passed
        }
        throw new Error('Expected function to throw an error, but it did not.');
    }
});

export const runAllTests = async (onResult: (result: TestResult) => void) => {
    suites.length = 0; // Clear previous runs if re-importing logic
    
    // We need to re-register suites by importing/executing the test definitions
    // This is handled by the consumer calling the test definition function
    
    for (const suite of suites) {
        for (const test of suite.tests) {
            const startTime = performance.now();
            try {
                // Run setup/teardown logic if we added it later
                await test.fn();
                onResult({
                    suite: suite.name,
                    name: test.name,
                    status: 'passed',
                    duration: performance.now() - startTime
                });
            } catch (e) {
                onResult({
                    suite: suite.name,
                    name: test.name,
                    status: 'failed',
                    duration: performance.now() - startTime,
                    error: e instanceof Error ? e.message : String(e)
                });
            }
        }
    }
};
