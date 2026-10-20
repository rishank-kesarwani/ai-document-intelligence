'use client';

import React, { useState } from 'react';
import { ExtractionJob, ExtractedField, DocumentEntity } from '../lib/types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Edit3,
  ExternalLink,
  RotateCcw,
  Check,
  X,
  Download,
  History,
  Layers,
  Search,
} from 'lucide-react';

interface ExtractionWorkspaceProps {
  job: ExtractionJob;
  document?: DocumentEntity;
  onEditField: (field: ExtractedField) => void;
  onApprove: () => void;
  onReject: () => void;
  onRetry: () => void;
  onOpenAuditTrail: () => void;
  onOpenExport: () => void;
}

export const ExtractionWorkspace: React.FC<ExtractionWorkspaceProps> = ({
  job,
  document,
  onEditField,
  onApprove,
  onReject,
  onRetry,
  onOpenAuditTrail,
  onOpenExport,
}) => {
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(
    job.fields.length > 0 ? job.fields[0].key : null,
  );

  const activeField = job.fields.find((f) => f.key === activeFieldKey) || job.fields[0];

  const getConfidenceBadge = (conf: number) => {
    const pct = Math.round(conf * 100);
    let color = 'var(--accent-emerald)';
    if (pct < 70) color = 'var(--accent-rose)';
    else if (pct < 85) color = 'var(--accent-amber)';

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.74rem',
          fontFamily: 'var(--font-mono)',
          color,
          fontWeight: 600,
        }}
      >
        {pct}%
      </span>
    );
  };

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: '2rem' }}>
      {/* Top Action & Status Bar */}
      <div className="pane-header" style={{ padding: '1rem 1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Extraction Job Workspace</h3>
              <span className={`badge badge-${job.status}`}>
                {job.status.toUpperCase().replace('_', ' ')}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                Job: {job.id.substring(0, 8)}...
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Schema: <strong>{job.schemaId}</strong> ({job.schemaVersion}) • Provider:{' '}
              {job.providerUsed || 'Deterministic PDF'} • Overall Confidence:{' '}
              {Math.round(job.overallConfidence * 100)}%
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {job.canRetry && (job.status === 'failed' || job.status === 'needs_review') && (
            <button className="btn btn-secondary btn-sm" onClick={onRetry} title="Idempotent safe retry">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Job</span>
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={onOpenAuditTrail} title="View human correction audit history">
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={onOpenExport} title="Export JSON / CSV with source traceability">
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export Data</span>
          </button>

          {job.status !== 'approved' && (
            <button className="btn btn-success btn-sm" onClick={onApprove} title="Approve document data for downstream export">
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </button>
          )}

          {job.status !== 'rejected' && (
            <button className="btn btn-danger btn-sm" onClick={onReject} title="Reject document extraction">
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </button>
          )}
        </div>
      </div>

      {/* Validation Warnings Banner */}
      {job.validationErrors && job.validationErrors.length > 0 && (
        <div className="alert-banner alert-warning" style={{ margin: '1rem 1.5rem 0', borderRadius: 'var(--radius-sm)' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <div>
            <strong>Cross-Field & Validation Rule Warnings ({job.validationErrors.length}):</strong>
            <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.8rem' }}>
              {job.validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Interactive Split Workspace */}
      <div className="workspace-grid" style={{ padding: '1.25rem 1.5rem', height: '620px' }}>
        {/* Left Pane: Document Text & Visual Evidence Viewer */}
        <div className="pane-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'rgba(7, 9, 14, 0.6)' }}>
          <div className="pane-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers className="w-4 h-4 text-indigo-400" />
              <h4 style={{ fontSize: '0.86rem', fontWeight: 600 }}>Evidence & Ground Truth Inspector</h4>
            </div>
            {activeField?.evidence && (
              <span className="badge badge-pdf" style={{ fontSize: '0.7rem' }}>
                Page {activeField.evidence.pageNumber}
              </span>
            )}
          </div>

          <div className="pane-body">
            {activeField ? (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                    Active Field Focus
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.1rem' }}>
                    {activeField.label} ({activeField.key})
                  </h3>
                </div>

                {/* Evidence Card */}
                {activeField.evidence ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Linked Source Snippet:
                    </div>
                    <div className="evidence-card active-highlight">
                      <div style={{ color: '#818cf8', marginBottom: '0.5rem', fontSize: '0.72rem' }}>
                        &bull; Page {activeField.evidence.pageNumber} Reference:
                      </div>
                      <div style={{ color: '#e2e8f0', lineHeight: 1.6 }}>
                        &quot;{activeField.evidence.snippet}&quot;
                      </div>
                    </div>

                    {/* Bounding Box Coordinate Box */}
                    {activeField.evidence.boundingBox && (
                      <div style={{ marginTop: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Bounding Box Coordinates (Normalized [0, 1]):
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span className="bounding-box-badge">
                            xMin: {activeField.evidence.boundingBox.xMin}
                          </span>
                          <span className="bounding-box-badge">
                            yMin: {activeField.evidence.boundingBox.yMin}
                          </span>
                          <span className="bounding-box-badge">
                            xMax: {activeField.evidence.boundingBox.xMax}
                          </span>
                          <span className="bounding-box-badge">
                            yMax: {activeField.evidence.boundingBox.yMax}
                          </span>
                        </div>

                        {/* Visual Bounding Box Canvas Mockup */}
                        <div
                          style={{
                            marginTop: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 'var(--radius-sm)',
                            height: '180px',
                            background: '#0d121f',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '8px',
                              fontSize: '0.65rem',
                              color: 'var(--text-dim)',
                            }}
                          >
                            Document Page 1 Canvas
                          </div>

                          {/* Highlight region */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${activeField.evidence.boundingBox.xMin * 100}%`,
                              top: `${activeField.evidence.boundingBox.yMin * 100}%`,
                              width: `${(activeField.evidence.boundingBox.xMax - activeField.evidence.boundingBox.xMin) * 100}%`,
                              height: '24px',
                              background: 'rgba(99, 102, 241, 0.25)',
                              border: '2px solid var(--primary)',
                              borderRadius: '3px',
                              boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 6px',
                              fontSize: '0.68rem',
                              color: '#fff',
                            }}
                          >
                            {String(activeField.value)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p style={{ fontSize: '0.86rem' }}>No direct evidence coordinates found for this field.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      The field may be missing or unextracted from source document.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                Select a field on the right to inspect linked evidence.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Schema Fields & Human Review Table */}
        <div className="pane-container" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div className="pane-header">
            <h4 style={{ fontSize: '0.86rem', fontWeight: 600 }}>Schema Extracted Fields</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Click field to highlight evidence
            </span>
          </div>

          <div className="pane-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Extracted Value</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {job.fields.map((field) => {
                  const isActive = field.key === activeFieldKey;

                  return (
                    <tr
                      key={field.key}
                      onClick={() => setActiveFieldKey(field.key)}
                      style={{
                        cursor: 'pointer',
                        background: isActive ? 'rgba(99, 102, 241, 0.12)' : undefined,
                        borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>
                          {field.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                          {field.key} • {field.type}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              fontFamily: typeof field.value === 'number' ? 'var(--font-mono)' : 'inherit',
                              fontWeight: 500,
                              color: field.value !== null ? 'var(--text-main)' : 'var(--text-dim)',
                            }}
                          >
                            {field.value !== null && field.value !== undefined
                              ? String(field.value)
                              : '<empty>'}
                          </span>
                          {field.isEdited && (
                            <span
                              className="badge"
                              style={{
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                fontSize: '0.65rem',
                              }}
                              title={`Original: ${field.originalValue}`}
                            >
                              Edited
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{getConfidenceBadge(field.confidence)}</td>
                      <td>
                        <span className={`badge badge-${field.validationStatus}`}>
                          {field.validationStatus.toUpperCase()}
                        </span>
                        {field.validationErrors && field.validationErrors.length > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#f87171', marginTop: '0.2rem' }}>
                            {field.validationErrors[0]}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditField(field);
                          }}
                          title="Human correct field value"
                        >
                          <Edit3 className="w-3 h-3 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
