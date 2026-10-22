'use client';

import React, { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api';
import { SqlExplainResult, SqlQueryResult } from '../lib/types';
import {
  Database,
  ShieldCheck,
  Play,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Lock,
} from 'lucide-react';

export const SafeSqlExplorer: React.FC = () => {
  const [nlQuery, setNlQuery] = useState('Show total count of documents');
  const [explainResult, setExplainResult] = useState<SqlExplainResult | null>(null);
  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [schemaInfo, setSchemaInfo] = useState<any | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getSqlSchema().then(setSchemaInfo).catch(console.warn);
  }, []);

  const sampleQueries = [
    'Show total count of documents',
    'Group documents by modality',
    'List all failed extraction jobs',
    'Show all approved documents',
    'Show extracted invoice amounts and vendor',
  ];

  const handleExplain = async () => {
    if (!nlQuery.trim()) return;
    setErrorMessage(null);
    setIsExplaining(true);
    try {
      const res = await api.explainSql(nlQuery.trim());
      setExplainResult(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Explain failed');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleExecute = async () => {
    if (!nlQuery.trim()) return;
    setErrorMessage(null);
    setIsExecuting(true);
    try {
      const res = await api.executeSql(nlQuery.trim());
      setQueryResult(res);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(`Execution Blocked [${err.errorType}]: ${err.message}`);
      } else {
        setErrorMessage(err?.message || 'Query execution failed');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database className="w-5 h-5 text-indigo-400" />
            Safe Natural-Language-to-SQL Explorer
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Constrained, read-only SQL query interface with AST validation, allowlisted schema, and tenant isolation.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowSchemaModal(!showSchemaModal)}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>{showSchemaModal ? 'Hide Schema' : 'View Allowlisted Schema'}</span>
        </button>
      </div>

      {/* Safety Safeguards Banner */}
      <div className="sql-safeguards-grid">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>Read-Only SELECT (DDL/DML blocked)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>AST Dialect Validation & Allowlist</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc' }}>
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>Mandatory Tenant Scoping Filter</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24' }}>
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>Statement Timeout (2000ms) & Limit 100</span>
        </div>
      </div>

      {/* Query Input & Sample Chips */}
      <div className="form-group">
        <label className="form-label">Ask a question about your documents and extraction data:</label>
        <div className="sql-query-bar">
          <input
            type="text"
            className="form-input"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            placeholder="e.g. Show total count of documents"
          />
          <button
            className="btn btn-secondary"
            onClick={handleExplain}
            disabled={isExplaining || isExecuting}
            title="Perform dry-run AST safety analysis without execution"
          >
            <FileCode className="w-4 h-4" />
            <span>{isExplaining ? 'Analyzing AST...' : 'Explain (Dry-Run)'}</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={isExplaining || isExecuting}
          >
            <Play className="w-4 h-4" />
            <span>{isExecuting ? 'Running...' : 'Execute Query'}</span>
          </button>
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {sampleQueries.map((sample, idx) => (
            <button
              key={idx}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              onClick={() => {
                setNlQuery(sample);
              }}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="alert-banner alert-error" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Explain / Dry-run Panel */}
      {explainResult && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a5b4fc' }}>
              AST-Verified Generated SQL (Dry-Run Analysis)
            </span>
            <span className="badge badge-completed" style={{ fontSize: '0.68rem' }}>
              Safety Check: PASSED
            </span>
          </div>

          <pre
            style={{
              padding: '0.75rem',
              background: '#07090e',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: '#38bdf8',
              overflowX: 'auto',
              marginBottom: '0.5rem',
            }}
          >
            {explainResult.generatedSql}
          </pre>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong>Human Explanation:</strong> {explainResult.explanation}
          </p>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
            Target Tables: <code>{explainResult.tablesQueried.join(', ')}</code> • Enforced Limit:{' '}
            {explainResult.rowLimitEnforced} rows • Timeout: {explainResult.timeoutLimitMs}ms
          </p>
        </div>
      )}

      {/* Query Execution Results Table */}
      {queryResult && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 600 }}>Query Execution Results</h4>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {queryResult.rowCount} rows returned in {queryResult.executionTimeMs}ms
            </span>
          </div>

          <div className="table-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {queryResult.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {queryResult.columns.map((col) => (
                      <td key={col} style={{ fontFamily: typeof row[col] === 'number' ? 'var(--font-mono)' : 'inherit' }}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '<null>'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schema Reference Panel */}
      {showSchemaModal && schemaInfo && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#818cf8' }}>
            Allowlisted Schema Catalog
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {schemaInfo.tables.map((t: any) => (
              <div
                key={t.tableName}
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                  <code>{t.tableName}</code>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                  {t.description}
                </div>
                <ul style={{ listStyle: 'none', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {t.columns.map((c: any) => (
                    <li key={c.name} style={{ padding: '2px 0' }}>
                      <span style={{ color: '#38bdf8' }}>{c.name}</span>{' '}
                      <span style={{ color: 'var(--text-dim)' }}>({c.type})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
