
import React, { useState, useEffect } from 'react';
import { runAllTests, type TestResult } from '../tests/testFramework';
import { registerTestSuites } from '../tests/appTests';
import { Spinner } from './Spinner';

interface TestDashboardProps {
    adminToken: string;
}

export const TestDashboard: React.FC<TestDashboardProps> = () => {
    const [results, setResults] = useState<TestResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, duration: 0 });

    useEffect(() => {
        // Initialize suites
        registerTestSuites();
    }, []);

    const handleRunTests = async () => {
        setIsRunning(true);
        setResults([]);
        setSummary({ total: 0, passed: 0, failed: 0, duration: 0 });
        
        const start = performance.now();
        
        await runAllTests((result) => {
            setResults(prev => [...prev, result]);
        });
        
        const end = performance.now();
        
        // Calculate final summary
        setResults(currentResults => {
             const passed = currentResults.filter(r => r.status === 'passed').length;
             const failed = currentResults.filter(r => r.status === 'failed').length;
             setSummary({
                 total: currentResults.length,
                 passed,
                 failed,
                 duration: end - start
             });
             return currentResults;
        });
        
        setIsRunning(false);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-150px)]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Diagnostics</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Run automated tests to verify platform integrity.</p>
                </div>
                <button
                    onClick={handleRunTests}
                    disabled={isRunning}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-md shadow-md font-medium flex items-center gap-2 disabled:opacity-70"
                >
                    {isRunning ? <Spinner /> : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    {isRunning ? 'Running Tests...' : 'Run All Tests'}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Total Tests</p>
                    <p className="text-2xl font-bold dark:text-white">{summary.total}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-green-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Passed</p>
                    <p className="text-2xl font-bold text-green-600">{summary.passed}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-gray-500">
                    <p className="text-xs font-bold text-gray-500 uppercase">Duration</p>
                    <p className="text-2xl font-bold dark:text-white">{summary.duration.toFixed(0)}ms</p>
                </div>
            </div>

            {/* Console Output */}
            <div className="flex-1 bg-gray-900 rounded-lg shadow-inner p-4 overflow-y-auto font-mono text-sm">
                {results.length === 0 && !isRunning ? (
                     <div className="text-gray-500 text-center mt-10">Ready to run tests. Press the button above.</div>
                ) : (
                    <div className="space-y-1">
                        {results.map((result, index) => (
                            <div key={index} className={`flex items-start gap-3 p-2 rounded hover:bg-white/5 ${result.status === 'failed' ? 'bg-red-900/20' : ''}`}>
                                <div className="flex-shrink-0 mt-0.5">
                                    {result.status === 'passed' ? (
                                        <span className="text-green-500">✓</span>
                                    ) : (
                                        <span className="text-red-500">✗</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-gray-400 text-xs">[{result.suite}]</span>
                                        <span className={`font-medium ${result.status === 'failed' ? 'text-red-400' : 'text-gray-200'}`}>{result.name}</span>
                                        <span className="text-gray-600 text-xs ml-auto">{result.duration.toFixed(1)}ms</span>
                                    </div>
                                    {result.error && (
                                        <div className="mt-1 pl-2 border-l-2 border-red-500 text-red-300 text-xs whitespace-pre-wrap">
                                            {result.error}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {isRunning && (
                    <div className="mt-4 flex items-center gap-2 text-gray-400 animate-pulse">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        Running...
                    </div>
                )}
            </div>
        </div>
    );
};
