'use client';

import React, { useState, useRef } from 'react';
import { api, ApiError } from '../lib/api';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Sparkles, Clock, Loader2 } from 'lucide-react';

interface DocumentUploadProps {
  onDocumentUploaded: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onDocumentUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFileUpload(e.target.files[0]);
    }
  };

  const processFileUpload = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Client-side pre-validation
    const maxSizeBytes = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSizeBytes) {
      setErrorMessage(`Oversized upload: File is ${(file.size / (1024 * 1024)).toFixed(2)}MB, exceeding maximum limit of 15MB.`);
      return;
    }

    const allowedMimes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (!allowedMimes.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g|webp)$/i)) {
      setErrorMessage(
        `Unsupported media type: Only PDF and image files (.pdf, .png, .jpg, .webp) are accepted.`,
      );
      return;
    }

    try {
      setIsUploading(true);
      const doc = await api.uploadDocument(file, retentionDays);
      setSuccessMessage(`Document "${doc.originalFilename}" uploaded successfully (${(doc.byteSize / 1024).toFixed(1)} KB, ${doc.pageCount} pages).`);
      onDocumentUploaded();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(`Upload Rejected [${err.errorType}]: ${err.message}`);
      } else {
        setErrorMessage(err?.message || 'Failed to upload document');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSeedDemoData = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      setIsSeeding(true);
      const docs = await api.seedDemoDocuments();
      setSuccessMessage(`Loaded ${docs.length} synthetic demonstration documents (Invoice, Contract, W-9 Tax Form).`);
      onDocumentUploaded();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to seed demonstration data');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            Secure Document Ingestion
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Upload PDFs or images for schema extraction. Content is inspected via binary magic bytes with tenant isolation.
          </p>
        </div>

        {/* Demo Data Seeder */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSeedDemoData}
          disabled={isSeeding || isUploading}
          title="Seed realistic synthetic Invoice, NDA Contract, and W-9 Tax Form"
        >
          {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
          <span>{isSeeding ? 'Seeding Demo Data...' : 'Load Synthetic Demo Docs'}</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          background: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.015)',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Verifying magic bytes and securing file buffer...
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <UploadCloud className="w-6 h-6 text-indigo-400" />
            </div>
            <p style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Drag & drop document here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse file</span>
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
              Supported: PDF, PNG, JPEG, WEBP • Max Size: 15MB • Max Page Count: 20 Pages
            </p>
          </div>
        )}
      </div>

      {/* Retention Controls & Limits Note */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Retention Policy:</span>
          <select
            className="form-select"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            style={{ width: '130px', padding: '3px 8px', fontSize: '0.78rem' }}
          >
            <option value={7}>7 Days</option>
            <option value={30}>30 Days (Demo)</option>
            <option value={90}>90 Days</option>
            <option value={0}>No Automatic Expiry</option>
          </select>
        </div>

        <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          Generated UUID Storage • Anti-Path-Traversal • Zero PII in Logs
        </div>
      </div>

      {/* Error / Success Feedback */}
      {errorMessage && (
        <div className="alert-banner alert-error" style={{ marginTop: '1rem', marginBottom: 0 }}>
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert-banner alert-info" style={{ marginTop: '1rem', marginBottom: 0, background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
