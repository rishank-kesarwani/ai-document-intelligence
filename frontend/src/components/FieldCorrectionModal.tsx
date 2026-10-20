'use client';

import React, { useState } from 'react';
import { ExtractedField } from '../lib/types';
import { Edit3, X, Check, AlertCircle } from 'lucide-react';

interface FieldCorrectionModalProps {
  field: ExtractedField;
  onSave: (fieldKey: string, newValue: any, reason: string, author: string) => Promise<void>;
  onClose: () => void;
}

export const FieldCorrectionModal: React.FC<FieldCorrectionModalProps> = ({
  field,
  onSave,
  onClose,
}) => {
  const [value, setValue] = useState<string>(
    field.value !== null && field.value !== undefined ? String(field.value) : '',
  );
  const [reason, setReason] = useState<string>('');
  const [author, setAuthor] = useState<string>('compliance-reviewer@tenant.com');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Audit reason is required for compliance traceability');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let parsedValue: any = value;
      if (field.type === 'number') {
        parsedValue = parseFloat(value);
        if (isNaN(parsedValue)) {
          setError('Value must be a valid number');
          setIsSubmitting(false);
          return;
        }
      }

      await onSave(field.key, parsedValue, reason.trim(), author.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update field');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pane-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Human Field Correction</h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '50%' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>FIELD KEY & TYPE</div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {field.label} (<code>{field.key}</code>) • {field.type}
            </div>
            {field.evidence && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Evidence Ground Truth: &quot;{field.evidence.snippet}&quot;
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Corrected Value *</label>
            <input
              type="text"
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Correction (Compliance Audit Trail) *</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Corrected OCR transposition error matching vendor receipt"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reviewer / Author Identity *</label>
            <input
              type="text"
              className="form-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert-banner alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Apply Correction & Revalidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
