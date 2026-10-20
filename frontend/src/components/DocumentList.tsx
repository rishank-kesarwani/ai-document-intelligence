'use client';

import React from 'react';
import { DocumentEntity, ExtractionSchema } from '../lib/types';
import { FileText, Trash2, Play, Sparkles, AlertCircle, FileSearch } from 'lucide-react';

interface DocumentListProps {
  documents: DocumentEntity[];
  schemas: ExtractionSchema[];
  selectedDocId?: string;
  onSelectDocument: (doc: DocumentEntity) => void;
  onTriggerExtraction: (docId: string, schemaId: string) => void;
  onDeleteDocument: (docId: string, hard: boolean) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  schemas,
  selectedDocId,
  onSelectDocument,
  onTriggerExtraction,
  onDeleteDocument,
}) => {
  if (documents.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>
        <FileSearch className="w-10 h-10 text-slate-500" style={{ margin: '0 auto 0.75rem' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>No Documents Ingested</h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Upload a PDF or image document above, or click &quot;Load Synthetic Demo Docs&quot; to test.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: '1.75rem' }}>
      <div className="pane-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText className="w-4 h-4 text-indigo-400" />
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600 }}>Ingested Documents Repository</h3>
          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
            {documents.length} Files
          </span>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Modality</th>
              <th>Size / Pages</th>
              <th>Uploaded</th>
              <th>Retention</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              const defaultSchemaId =
                doc.metadata?.schemaId ||
                (doc.originalFilename.toLowerCase().includes('contract') ? 'contract-v1' :
                 doc.originalFilename.toLowerCase().includes('tax') ? 'tax-form-w9' : 'invoice-v1');

              return (
                <tr
                  key={doc.id}
                  style={{
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined,
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                        {doc.originalFilename}
                      </span>
                      {doc.isDemo && (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '0.65rem' }}>
                          <Sparkles className="w-2.5 h-2.5" /> Demo
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      ID: {doc.id.substring(0, 8)}...
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${doc.modality}`}>
                      {doc.modality.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem' }}>{(doc.byteSize / 1024).toFixed(1)} KB</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {doc.pageCount} {doc.pageCount === 1 ? 'Page' : 'Pages'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {new Date(doc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.78rem', color: doc.retentionExpiresAt ? 'var(--text-muted)' : 'var(--text-dim)' }}>
                      {doc.retentionExpiresAt
                        ? `Expires: ${new Date(doc.retentionExpiresAt).toLocaleDateString()}`
                        : 'No Expiry'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select
                        id={`schema-select-${doc.id}`}
                        defaultValue={defaultSchemaId}
                        className="form-select"
                        style={{ padding: '3px 6px', fontSize: '0.75rem', width: '135px' }}
                      >
                        {schemas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name.split('&')[0]}
                          </option>
                        ))}
                      </select>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const select = document.getElementById(`schema-select-${doc.id}`) as HTMLSelectElement;
                          const schemaId = select?.value || defaultSchemaId;
                          onSelectDocument(doc);
                          onTriggerExtraction(doc.id, schemaId);
                        }}
                        title="Run schema extraction engine"
                      >
                        <Play className="w-3 h-3" />
                        <span>Extract</span>
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectDocument(doc)}
                        title="Select document"
                      >
                        Select
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm(`Permanently delete document "${doc.originalFilename}"?`)) {
                            onDeleteDocument(doc.id, true);
                          }
                        }}
                        title="Hard delete document and storage"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
