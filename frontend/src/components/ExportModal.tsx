'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ExtractionJob } from '../lib/types';
import { Download, X, Copy, Check, FileJson, FileSpreadsheet } from 'lucide-react';

interface ExportModalProps {
  job: ExtractionJob;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ job, onClose }) => {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [data, setData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getExportData(job.id, format)
      .then(setData)
      .catch((err) => setData(`Error generating export: ${err.message}`))
      .finally(() => setLoading(false));
  }, [job.id, format]);

  const handleCopy = () => {
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([data], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${job.schemaId}-${job.id.substring(0, 8)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="pane-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download className="w-4 h-4 text-indigo-400" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Export Approved Data & Traceability</h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '50%' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            {/* Format toggle */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn btn-sm ${format === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormat('json')}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON Format</span>
              </button>
              <button
                className={`btn btn-sm ${format === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormat('csv')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV Format</span>
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCopy} disabled={loading}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDownload} disabled={loading}>
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            </div>
          </div>

          {/* Traceability Metadata Bar */}
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
              marginBottom: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <span>Job: {job.id.substring(0, 8)}...</span>
            <span>Doc: {job.documentId.substring(0, 8)}...</span>
            <span>Tenant: {job.tenantId}</span>
            <span>Status: {job.status}</span>
          </div>

          {/* Preview Box */}
          <div
            style={{
              background: '#07090e',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              maxHeight: '340px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              color: '#cbd5e1',
            }}
          >
            {loading ? 'Formatting export payload...' : data}
          </div>
        </div>
      </div>
    </div>
  );
};
