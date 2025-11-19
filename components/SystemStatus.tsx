import React, { useState, useEffect } from 'react';
import { getDatabaseSchema, generateSqlExport } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';

interface SystemStatusProps {
  adminToken: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ adminToken }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'export'>('schema');
  const [schema, setSchema] = useState('');
  const [exportSql, setExportSql] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const schemaData = await getDatabaseSchema(adminToken);
      setSchema(schemaData);
      
      if (activeTab === 'export') {
          const data = await generateSqlExport(adminToken);
          setExportSql(data);
      }
      
      setIsLoading(false);
    };
    load();
  }, [activeTab, adminToken]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus('Copied!');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">System Status & Backup</h2>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-6">
              <button 
                onClick={() => setActiveTab('schema')} 
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'schema' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                  Database Schema
              </button>
              <button 
                onClick={() => setActiveTab('export')} 
                className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'export' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              >
                  Data Export (SQL)
              </button>
          </nav>
      </div>

      {isLoading ? <ContentLoader /> : (
        <div className="relative bg-gray-900 rounded-lg p-4 shadow-inner">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                {copyStatus && <span className="text-green-400 text-xs font-bold animate-pulse">{copyStatus}</span>}
                <button 
                    onClick={() => handleCopy(activeTab === 'schema' ? schema : exportSql)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded border border-gray-600 transition-colors"
                >
                    Copy to Clipboard
                </button>
            </div>
            <pre className="text-sm text-gray-300 font-mono overflow-auto max-h-[70vh] whitespace-pre-wrap">
                {activeTab === 'schema' ? schema : exportSql}
            </pre>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Deployment Note</h4>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              To deploy this application to production:
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>Set up a PostgreSQL database.</li>
                  <li>Run the <strong>Database Schema</strong> SQL to create tables.</li>
                  <li>(Optional) Run the <strong>Data Export</strong> SQL to migrate your prototype data.</li>
                  <li>Configure the backend environment variables (`DATABASE_URL`, etc.) as described in <code>server/backend.ts</code>.</li>
              </ol>
          </p>
      </div>
    </div>
  );
};
