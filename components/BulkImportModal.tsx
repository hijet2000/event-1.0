
import React, { useState, useRef } from 'react';
import { bulkImportRegistrations } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
  adminToken: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImportSuccess, adminToken }) => {
  const [csvData, setCsvData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ successCount: number; errorCount: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setCsvData('');
    setIsImporting(false);
    setResult(null);
    setError(null);
    setShowConfirm(false);
    onClose();
  };
  
  const handleAttemptImport = () => {
    if (!csvData.trim()) {
      setError("Please paste CSV data or upload a file.");
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
          setCsvData(text);
          setError(null);
      }
    };
    reader.onerror = () => {
        setError("Failed to read file.");
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    setIsImporting(true);
    setShowConfirm(false);
    setResult(null);
    try {
      const importResult = await bulkImportRegistrations(adminToken, csvData);
      setResult(importResult);
      if (importResult.successCount > 0 && importResult.errorCount === 0) {
        // Only call full success if there are no errors, otherwise user might want to see errors
        setTimeout(() => {
            onImportSuccess();
            handleClose();
        }, 1500)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;
  
  const renderContent = () => {
      if (isImporting) {
        return (
            <div className="text-center py-10">
                <Spinner />
                <p className="mt-4 text-lg font-medium">Importing, please wait...</p>
                <p className="text-sm text-gray-500">This may take a moment for large lists.</p>
            </div>
        );
      }

      if (result) {
          return (
              <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Import Complete</h3>
                  <div className="mt-4">
                      <Alert type={result.errorCount === 0 ? 'success' : 'warning'} message={`Successfully imported ${result.successCount} users. Failed to import ${result.errorCount} users.`} />
                  </div>
                  {result.errors.length > 0 && (
                      <div className="mt-4 max-h-40 overflow-y-auto rounded-md bg-gray-100 dark:bg-gray-900 p-3">
                          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Error Details:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                      </div>
                  )}
              </div>
          );
      }

      if (showConfirm) {
        const lineCount = Math.max(0, csvData.trim().split('\n').filter(line => line.trim()).length - 1);
        return (
            <div>
                <h2 id="import-title" className="text-xl font-bold text-gray-900 dark:text-white">Confirm Bulk Import</h2>
                <div className="mt-4">
                     <p className="text-sm text-gray-600 dark:text-gray-400">
                        You are about to import approximately <strong className="text-gray-800 dark:text-gray-200">{lineCount}</strong> new registrations.
                    </p>
                    <div className="mt-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 text-sm">
                        <p><strong>Warning:</strong> This action cannot be undone. Please ensure your data is correctly formatted and does not contain existing users.</p>
                    </div>
                </div>
            </div>
        );
      }
      
      return (
          <div>
            <h2 id="import-title" className="text-xl font-bold text-gray-900 dark:text-white">Bulk Import Registrations</h2>
            <div className="mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Upload a CSV file or paste data below. The format should be two columns: `name, email`.
              </p>
              
              <div className="flex gap-2 mb-4">
                  <input 
                    type="file" 
                    accept=".csv,.txt" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Upload CSV File
                  </button>
              </div>

              <div className="mt-2 p-2 rounded-md bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm">
                  <strong>Expected Format:</strong><br />
                  <pre className="mt-1 font-mono text-xs overflow-x-auto"><code>
                      name,email<br/>
                      John Doe,john.doe@example.com<br/>
                      Jane Smith,jane.smith@example.com
                  </code></pre>
                  <p className="mt-1 text-xs italic text-gray-500">Supports comma (CSV) or tab (Excel copy-paste) separation.</p>
              </div>
            </div>
            <div className="mt-4">
              <textarea
                rows={8}
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Paste data here..."
                className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>
            {error && <div className="mt-2"><Alert type="error" message={error} /></div>}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {renderContent()}
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
          {result ? (
            <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
              Close
            </button>
          ) : showConfirm ? (
            <>
              <button type="button" onClick={() => setShowConfirm(false)} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 flex items-center justify-center"
              >
                Confirm & Import
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAttemptImport}
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center"
              >
                Next Step
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
