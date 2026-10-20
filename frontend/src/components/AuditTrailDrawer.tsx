'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AuditRecord, ExtractionJob } from '../lib/types';
import { History, X, Clock, User, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface AuditTrailDrawerProps {
  job: ExtractionJob;
  onClose: () => void;
}

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({ job, onClose }) => {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuditTrail(job.id)
      .then(setRecords)
      .catch((err) => console.error('Failed to load audit trail', err))
      .finally(() => setLoading(false));
  }, [job.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="pane-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History className="w-4 h-4 text-indigo-400" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Compliance Audit Trail & Lineage</h3>
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
          {/* Decision Status if Approved/Rejected */}
          {job.decision && (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: job.decision.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${job.decision.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: job.decision.status === 'approved' ? '#34d399' : '#f87171' }}>
                <ShieldCheck className="w-4 h-4" />
                <span>Job Status: {job.decision.status.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Reviewer: <strong>{job.decision.reviewerId}</strong> • Timestamp:{' '}
                {new Date(job.decision.timestamp).toLocaleString()}
              </div>
              {job.decision.decisionNotes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                  &quot;{job.decision.decisionNotes}&quot;
                </div>
              )}
            </div>
          )}

          {/* Field-Level Corrections List */}
          <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Field-Level Correction History ({records.length})
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
              Loading audit logs...
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
              No human corrections recorded for this job. All fields match initial model output.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {records.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      <code>{rec.fieldKey}</code>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      <Clock className="w-3 h-3" />
                      <span>{new Date(rec.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Before / After */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', fontSize: '0.82rem' }}>
                    <span style={{ color: '#f87171', textDecoration: 'line-through' }}>
                      {String(rec.previousValue ?? '<empty>')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      {String(rec.newValue)}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    Reason: {rec.reason}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
                    <User className="w-3 h-3" />
                    <span>Author: {rec.author}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
