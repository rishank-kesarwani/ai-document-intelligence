'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../lib/api';
import {
  DocumentEntity,
  ExtractionSchema,
  ExtractionJob,
  ExtractedField,
} from '../lib/types';
import { Header } from '../components/Header';
import { DocumentUpload } from '../components/DocumentUpload';
import { DocumentList } from '../components/DocumentList';
import { ExtractionWorkspace } from '../components/ExtractionWorkspace';
import { FieldCorrectionModal } from '../components/FieldCorrectionModal';
import { AuditTrailDrawer } from '../components/AuditTrailDrawer';
import { ExportModal } from '../components/ExportModal';
import { SafeSqlExplorer } from '../components/SafeSqlExplorer';
import {
  FolderUp,
  Sparkles,
  Layers,
  Database,
  History,
  FileCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function Home() {
  const [tenantId, setTenantId] = useState('tenant-demo-default');
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'documents' | 'extraction' | 'sql'>('documents');

  const [documents, setDocuments] = useState<DocumentEntity[]>([]);
  const [schemas, setSchemas] = useState<ExtractionSchema[]>([]);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentEntity | undefined>(undefined);
  const [activeJob, setActiveJob] = useState<ExtractionJob | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Modals state
  const [editingField, setEditingField] = useState<ExtractedField | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const [docsData, schemasData, jobsData] = await Promise.all([
        api.listDocuments(),
        api.listSchemas(),
        api.listJobs(),
      ]);

      setDocuments(docsData);
      setSchemas(schemasData);
      setJobs(jobsData);

      if (jobsData.length > 0 && !activeJob) {
        setActiveJob(jobsData[0]);
      }
      if (docsData.length > 0 && !selectedDoc) {
        setSelectedDoc(docsData[0]);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Failed to connect to Document Intelligence backend API.');
    } finally {
      setLoading(false);
    }
  }, [activeJob, selectedDoc]);

  useEffect(() => {
    loadInitialData();
  }, [tenantId, isDemoMode, loadInitialData]);

  const handleTenantChange = (newTenant: string) => {
    setTenantId(newTenant);
    api.setTenantId(newTenant);
    setSelectedDoc(undefined);
    setActiveJob(null);
  };

  const handleTriggerExtraction = async (docId: string, schemaId: string) => {
    setErrorBanner(null);
    try {
      const job = await api.triggerExtraction(docId, schemaId);
      setActiveJob(job);
      setJobs((prev) => [job, ...prev]);
      setActiveTab('extraction');
    } catch (err: any) {
      setErrorBanner(`Extraction Trigger Failed: ${err?.message}`);
    }
  };

  const handleDeleteDocument = async (docId: string, hard: boolean) => {
    try {
      await api.deleteDocument(docId, hard);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(undefined);
    } catch (err: any) {
      setErrorBanner(`Delete failed: ${err?.message}`);
    }
  };

  const handleFieldSave = async (
    fieldKey: string,
    newValue: any,
    reason: string,
    author: string,
  ) => {
    if (!activeJob) return;
    const res = await api.updateField(activeJob.id, fieldKey, newValue, reason, author);
    setActiveJob(res.job);
    setJobs((prev) => prev.map((j) => (j.id === res.job.id ? res.job : j)));
  };

  const handleApprove = async () => {
    if (!activeJob) return;
    try {
      const updated = await api.approveJob(activeJob.id, `compliance-officer@${tenantId}`, 'Approved after manual inspection');
      setActiveJob(updated);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      setErrorBanner(`Approval failed: ${err?.message}`);
    }
  };

  const handleReject = async () => {
    if (!activeJob) return;
    try {
      const updated = await api.rejectJob(activeJob.id, `compliance-officer@${tenantId}`, 'Rejected by human reviewer');
      setActiveJob(updated);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      setErrorBanner(`Rejection failed: ${err?.message}`);
    }
  };

  const handleRetry = async () => {
    if (!activeJob) return;
    try {
      const updated = await api.retryJob(activeJob.id);
      setActiveJob(updated);
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      setErrorBanner(`Retry failed: ${err?.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        tenantId={tenantId}
        onTenantChange={handleTenantChange}
        isDemoMode={isDemoMode}
        onDemoModeToggle={setIsDemoMode}
      />

      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '1.5rem', flex: 1 }}>
        {/* Global Error Banner */}
        {errorBanner && (
          <div className="alert-banner alert-error">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FolderUp className="w-4 h-4" />
            <span>Document Ingestion ({documents.length})</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'extraction' ? 'active' : ''}`}
            onClick={() => setActiveTab('extraction')}
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Extraction & Evidence Review {activeJob ? `(${activeJob.status})` : ''}
            </span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'sql' ? 'active' : ''}`}
            onClick={() => setActiveTab('sql')}
          >
            <Database className="w-4 h-4" />
            <span>Safe NL-to-SQL Explorer</span>
          </button>
        </div>

        {/* Tab 1: Documents Ingestion */}
        {activeTab === 'documents' && (
          <div>
            <DocumentUpload onDocumentUploaded={loadInitialData} />
            <DocumentList
              documents={documents}
              schemas={schemas}
              selectedDocId={selectedDoc?.id}
              onSelectDocument={(doc) => {
                setSelectedDoc(doc);
                // Find matching job if exists
                const existingJob = jobs.find((j) => j.documentId === doc.id);
                if (existingJob) setActiveJob(existingJob);
              }}
              onTriggerExtraction={handleTriggerExtraction}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
        )}

        {/* Tab 2: Extraction & Evidence Workspace */}
        {activeTab === 'extraction' && (
          <div>
            {/* Job selector if multiple jobs exist */}
            {jobs.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Select Job:</span>
                <select
                  className="form-select"
                  value={activeJob?.id}
                  onChange={(e) => {
                    const found = jobs.find((j) => j.id === e.target.value);
                    if (found) setActiveJob(found);
                  }}
                  style={{ width: 'auto', minWidth: '220px', padding: '4px 8px', fontSize: '0.8rem' }}
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.schemaId} - {j.status.toUpperCase()} ({new Date(j.createdAt).toLocaleTimeString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeJob ? (
              <ExtractionWorkspace
                job={activeJob}
                document={documents.find((d) => d.id === activeJob.documentId)}
                onEditField={setEditingField}
                onApprove={handleApprove}
                onReject={handleReject}
                onRetry={handleRetry}
                onOpenAuditTrail={() => setShowAuditTrail(true)}
                onOpenExport={() => setShowExportModal(true)}
              />
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <Layers className="w-12 h-12 text-slate-500" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>No Active Extraction Job</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Please go to &quot;Document Ingestion&quot; and click &quot;Extract&quot; on any uploaded document.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                  onClick={() => setActiveTab('documents')}
                >
                  Go to Ingestion
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Safe NL-to-SQL Explorer */}
        {activeTab === 'sql' && <SafeSqlExplorer />}
      </main>

      {/* Modals & Drawers */}
      {editingField && (
        <FieldCorrectionModal
          field={editingField}
          onSave={handleFieldSave}
          onClose={() => setEditingField(null)}
        />
      )}

      {showAuditTrail && activeJob && (
        <AuditTrailDrawer
          job={activeJob}
          onClose={() => setShowAuditTrail(false)}
        />
      )}

      {showExportModal && activeJob && (
        <ExportModal
          job={activeJob}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
