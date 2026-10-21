'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { SystemCapabilities } from '../lib/types';
import { Shield, Sparkles, Lock } from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
  tenantId: string;
  onTenantChange: (tenant: string) => void;
  isDemoMode: boolean;
  onDemoModeToggle: (enabled: boolean) => void;
  isPublicAccessEnabled: boolean;
  backendPublicAccessEnabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  tenantId,
  onTenantChange,
  isDemoMode,
  onDemoModeToggle,
  isPublicAccessEnabled,
  backendPublicAccessEnabled,
}) => {
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [isTenantEditing, setIsTenantEditing] = useState(false);
  const [tempTenant, setTempTenant] = useState(tenantId);

  useEffect(() => {
    api.getCapabilities()
      .then(setCapabilities)
      .catch((err) => console.warn('Could not load capabilities', err));
  }, []);

  const handleTenantSave = () => {
    if (tempTenant.trim()) {
      onTenantChange(tempTenant.trim());
      api.setTenantId(tempTenant.trim());
    }
    setIsTenantEditing(false);
  };

  const isDemoPermitted = isPublicAccessEnabled && backendPublicAccessEnabled !== false;

  return (
    <header className="app-header">
      <div className="brand-section">
        <Logo size={36} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className="brand-title">Document Intelligence</h1>
            <span className="brand-tag">v1.0 MVP</span>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
            Secure Ingestion • Evidence Linking • Business Rule Review • Safe SQL
          </p>
        </div>
      </div>

      <div className="header-controls">
        {/* Modality & Public Access Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
          }}
          title={
            capabilities?.modalities.image.supported
              ? 'PDF & Image Modalities Active'
              : 'PDF Token Extractor Active (Images require OCR_ENGINE_ENABLED)'
          }
        >
          <span className="status-dot" />
          <span style={{ color: 'var(--text-muted)' }}>
            PDF: <strong style={{ color: 'var(--accent-emerald)' }}>Active</strong> | OCR:{' '}
            <strong
              style={{
                color: capabilities?.modalities.image.supported
                  ? 'var(--accent-emerald)'
                  : 'var(--accent-amber)',
              }}
            >
              {capabilities?.modalities.image.supported ? 'Active' : 'Pattern'}
            </strong>
          </span>
        </div>

        {/* Demo Mode Toggle or Disabled Policy Indicator */}
        {isDemoPermitted ? (
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const next = !isDemoMode;
              onDemoModeToggle(next);
              api.setDemoMode(next);
            }}
            style={{
              borderColor: isDemoMode ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)',
              background: isDemoMode ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            }}
            title="Toggle client demo exploration mode"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Demo Mode: {isDemoMode ? 'ON' : 'OFF'}</span>
          </button>
        ) : (
          <div
            className="btn btn-sm btn-secondary"
            style={{
              opacity: 0.7,
              cursor: 'not-allowed',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--text-muted)',
            }}
            title="Public demo access is disabled by environment policy. Authenticated tenant context is required."
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>Demo: Disabled (Policy)</span>
          </div>
        )}

        {/* Tenant Boundary Selector */}
        <div className="tenant-badge">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          {isTenantEditing ? (
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <input
                type="text"
                value={tempTenant}
                onChange={(e) => setTempTenant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTenantSave()}
                className="form-input"
                style={{
                  padding: '2px 6px',
                  fontSize: '0.78rem',
                  width: '130px',
                  height: '24px',
                }}
                autoFocus
              />
              <button className="btn btn-sm btn-primary" onClick={handleTenantSave}>
                Save
              </button>
            </div>
          ) : (
            <span
              onClick={() => setIsTenantEditing(true)}
              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-dim)' }}
              title="Click to switch tenant boundary"
            >
              Tenant: <strong style={{ color: 'var(--text-main)' }}>{tenantId}</strong>
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
