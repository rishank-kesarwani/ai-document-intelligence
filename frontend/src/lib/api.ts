import type {
  DocumentEntity,
  ExtractionSchema,
  ExtractionJob,
  AuditRecord,
  SystemCapabilities,
  SqlExplainResult,
  SqlQueryResult,
} from './types';

export class ApiError extends Error {
  statusCode: number;
  errorType: string;
  correlationId?: string;

  constructor(message: string, statusCode: number, errorType: string, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.correlationId = correlationId;
  }
}

export class ApiClient {
  private baseUrl: string;
  private currentTenantId: string;
  private demoMode: boolean;
  private sqlAuthorized: boolean;
  private publicAccessEnabled: boolean;

  constructor() {
    let raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    raw = raw.replace(/\/+$/, '');
    // Ensure base URL includes /api/v1 exactly once
    if (!raw.endsWith('/api/v1')) {
      raw = `${raw}/api/v1`;
    }
    this.baseUrl = raw;

    this.currentTenantId =
      process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'tenant-demo-default';

    this.publicAccessEnabled =
      process.env.NEXT_PUBLIC_ACCESS_ENABLED !== 'false';
    this.demoMode = this.publicAccessEnabled;
    this.sqlAuthorized = true;
  }

  setTenantId(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  getTenantId(): string {
    return this.currentTenantId;
  }

  getDefaultTenantId(): string {
    return process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'tenant-demo-default';
  }

  setDemoMode(enabled: boolean) {
    this.demoMode = enabled;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  isPublicAccessEnabled(): boolean {
    return this.publicAccessEnabled;
  }

  setSqlAuthorized(authorized: boolean) {
    this.sqlAuthorized = authorized;
  }

  isSqlAuthorized(): boolean {
    return this.sqlAuthorized;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  normalizeUrl(endpoint: string): string {
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    // Guard against accidental duplication of /api/v1 prefix
    if (cleanEndpoint.startsWith('/api/v1/')) {
      cleanEndpoint = cleanEndpoint.replace('/api/v1', '');
    } else if (cleanEndpoint === '/api/v1') {
      cleanEndpoint = '';
    }
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'x-tenant-id': this.currentTenantId,
      ...(this.demoMode ? { 'x-demo-mode': 'true' } : {}),
      ...(this.sqlAuthorized ? { 'x-sql-authorized': 'true' } : {}),
      ...extra,
    };
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = this.normalizeUrl(endpoint);

    try {
      const res = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
      });

      if (!res.ok) {
        let errJson: any = null;
        try {
          errJson = await res.json();
        } catch {
          // not JSON
        }
        const message = errJson?.message || `Request failed with status ${res.status}`;
        const errorType = errJson?.error || 'HttpError';
        const correlationId = res.headers.get('x-correlation-id') || errJson?.correlationId;

        throw new ApiError(
          Array.isArray(message) ? message.join(', ') : message,
          res.status,
          errorType,
          correlationId,
        );
      }

      return res.json() as Promise<T>;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Network request failed', 0, 'NetworkError');
    }
  }

  // Capabilities
  async getCapabilities(): Promise<SystemCapabilities> {
    return this.request<SystemCapabilities>('/capabilities');
  }

  // Documents
  async listDocuments(): Promise<DocumentEntity[]> {
    return this.request<DocumentEntity[]>('/documents');
  }

  async getDocument(id: string): Promise<DocumentEntity> {
    return this.request<DocumentEntity>(`/documents/${id}`);
  }

  getDocumentContentUrl(id: string): string {
    return this.normalizeUrl(`/documents/${id}/content?tenantId=${this.currentTenantId}`);
  }

  async uploadDocument(file: File, retentionDays?: number, documentType?: string): Promise<DocumentEntity> {
    const formData = new FormData();
    formData.append('file', file);
    if (retentionDays) formData.append('retentionDays', retentionDays.toString());
    if (documentType) formData.append('documentType', documentType);

    const url = this.normalizeUrl('/documents/upload');
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const message = errJson?.message || `Upload failed with status ${res.status}`;
      throw new ApiError(
        Array.isArray(message) ? message.join(', ') : message,
        res.status,
        errJson?.error || 'UploadError',
        res.headers.get('x-correlation-id') || undefined,
      );
    }

    return res.json();
  }

  async seedDemoDocuments(): Promise<DocumentEntity[]> {
    return this.request<DocumentEntity[]>('/documents/demo/seed', { method: 'POST' });
  }

  async deleteDocument(id: string, hard = false): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/documents/${id}?hard=${hard}`, {
      method: 'DELETE',
    });
  }

  // Schemas
  async listSchemas(): Promise<ExtractionSchema[]> {
    return this.request<ExtractionSchema[]>('/schemas');
  }

  async getSchema(id: string): Promise<ExtractionSchema> {
    return this.request<ExtractionSchema>(`/schemas/${id}`);
  }

  // Jobs
  async listJobs(): Promise<ExtractionJob[]> {
    return this.request<ExtractionJob[]>('/jobs');
  }

  async getJob(id: string): Promise<ExtractionJob> {
    return this.request<ExtractionJob>(`/jobs/${id}`);
  }

  async triggerExtraction(documentId: string, schemaId: string): Promise<ExtractionJob> {
    return this.request<ExtractionJob>('/jobs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, schemaId }),
    });
  }

  async retryJob(id: string): Promise<ExtractionJob> {
    return this.request<ExtractionJob>(`/jobs/${id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  // Review
  async updateField(
    jobId: string,
    fieldKey: string,
    newValue: any,
    reason: string,
    author?: string,
  ): Promise<{ success: boolean; job: ExtractionJob; auditRecord: AuditRecord }> {
    return this.request<{ success: boolean; job: ExtractionJob; auditRecord: AuditRecord }>(
      `/review/jobs/${jobId}/fields/${fieldKey}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newValue, reason, author }),
      },
    );
  }

  async approveJob(jobId: string, reviewerId?: string, notes?: string): Promise<ExtractionJob> {
    return this.request<ExtractionJob>(`/review/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId, notes }),
    });
  }

  async rejectJob(jobId: string, reviewerId?: string, notes?: string): Promise<ExtractionJob> {
    return this.request<ExtractionJob>(`/review/jobs/${jobId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerId, notes }),
    });
  }

  async getAuditTrail(jobId: string): Promise<AuditRecord[]> {
    return this.request<AuditRecord[]>(`/review/jobs/${jobId}/audit-trail`);
  }

  // Export
  getExportUrl(jobId: string, format: 'json' | 'csv'): string {
    return this.normalizeUrl(`/export/jobs/${jobId}?format=${format}`);
  }

  async getExportData(jobId: string, format: 'json' | 'csv'): Promise<string> {
    const url = this.getExportUrl(jobId, format);
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.text();
  }

  // Safe SQL
  async getSqlSchema(): Promise<any> {
    return this.request('/sql/schema');
  }

  async explainSql(query: string): Promise<SqlExplainResult> {
    return this.request<SqlExplainResult>('/sql/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  }

  async executeSql(
    naturalLanguageQuery: string,
    explicitSql?: string,
    dryRun = false,
  ): Promise<SqlQueryResult> {
    return this.request<SqlQueryResult>('/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naturalLanguageQuery, explicitSql, dryRun }),
    });
  }
}

export const api = new ApiClient();
