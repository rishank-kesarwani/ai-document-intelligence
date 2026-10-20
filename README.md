# AI Multimodal Document Intelligence Platform

Secure ingestion, schema-constrained extraction, evidence-linked fields, validation rules, human exception review, and safe natural-language queries.

---

## 1. System Architecture & Boundaries

The platform is designed around two completely independent, decoupled deployable applications:

```
ai-document-intelligence/
├── backend/                       # NestJS API application (Target: Render)
│   ├── src/
│   │   ├── common/                # Filters, guards, interceptors, correlation ID middleware
│   │   ├── modules/
│   │   │   ├── health/            # Root metadata, /health/liveness, /health/readiness, /capabilities
│   │   │   ├── documents/         # Secure upload, magic-byte inspection, synthetic demo data, retention
│   │   │   ├── schemas/           # Invoices, Contracts, W-9 Tax Forms, custom schemas
│   │   │   ├── extraction/        # Deterministic PDF token extractor, OCR provider adapter, evidence linker
│   │   │   ├── review/            # Human corrections, audit trail logging, approval/rejection
│   │   │   ├── export/            # Traceable JSON & CSV exports
│   │   │   ├── sql/               # Safe NL-to-SQL with AST validation, allowlist, tenant isolation
│   │   │   └── shared-services/   # Local storage adapter, resilient notification webhook adapter
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/                      # End-to-end integration test suite
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                      # Next.js 14 App Router application (Target: Vercel)
│   ├── src/
│   │   ├── app/                   # Root layout, main dashboard
│   │   ├── components/            # Header, DocumentUpload, DocumentList, ExtractionWorkspace, Modals
│   │   ├── lib/                   # Unified API client, type definitions
│   │   └── styles/                # Vanilla CSS design system, glassmorphism tokens
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json
│
├── scripts/
│   └── vercel-ignore-build-step.sh # Deployment filter script for Vercel
├── render.yaml                    # Render Blueprint configuration for backend
├── .env.example                   # Annotated environment variable reference
└── package.json                   # Root convenience scripts for local verification only
```

---

## 2. Document Modality Capabilities & Explicit Limitations

- **PDF Documents (`application/pdf`)**: **Fully Active**.
  Extracted via `DeterministicPdfProvider` utilizing `pdf-parse` for page parsing and layout token coordinate mapping. Fields are extracted and assigned normalized bounding boxes (`xMin`, `yMin`, `xMax`, `yMax`), page numbers, and contextual snippets.
- **Image Documents (`image/png`, `image/jpeg`, `image/webp`)**: **Scoped Adapter with Explicit Limitation Reporting**.
  File uploads undergo binary magic-byte verification (`89 50 4E 47`, `FF D8 FF`, `RIFF...WEBP`). Extraction is managed by `OcrAdapterProvider`. If `OCR_ENGINE_ENABLED=false` and no external multimodal key (`AI_PLATFORM_API_KEY`) is provided, the platform explicitly reports the modality limitation:
  > *Modality Limitation: Image OCR processing requires OCR engine or external multimodal provider to be configured (`OCR_ENGINE_ENABLED=true` or `AI_PLATFORM_API_KEY`). Native PDF extraction is fully active.*
- **No Fictional Endpoints**: The application operates without fictional OCR or external AI dependencies. All capabilities are introspectable in real-time via `GET /api/v1/capabilities`.

---

## 3. Upload Security & Data Protection

- **Magic Byte Verification**: `MagicBytesUtil` verifies the real binary header bytes (PDF `%PDF-`, PNG, JPEG, WEBP), defending against file extension spoofing or malicious executables disguised as documents.
- **Explicit Size & Page Limits**: Enforces a strict upload limit of 15MB (`MAX_UPLOAD_BYTES`) and 20 pages (`MAX_PAGE_COUNT`). Oversized files are rejected with `413 Payload Too Large`.
- **Anti-Path Traversal & UUID Storage**: Files are saved with cryptographically random UUID names within `STORAGE_DIR`. Original filenames are sanitized and stored only as metadata. Canonical path resolution ensures files cannot escape the storage boundary.
- **Tenant Boundaries**: Every request requires tenant context (`x-tenant-id` header). Cross-tenant access to documents, extraction jobs, or exports is rejected with `403 Forbidden`.
- **Zero Log Leakage**: Logging interceptors sanitize inputs; raw document contents, full prompts, personal information, and credentials are never written to logs. Correlation IDs (`x-correlation-id`) accompany all operations.

---

## 4. Extraction Schemas & Cross-Field Business Rules

Pre-configured schemas are available out-of-the-box:

1. **Invoice & Accounts Payable (`invoice-v1`)**:
   - Fields: `invoice_number`, `vendor_name`, `invoice_date`, `due_date`, `currency`, `subtotal`, `tax_amount`, `total_amount`, `payment_status`.
   - Cross-Field Math Rule: `subtotal + tax_amount === total_amount` (with floating-point tolerance).
   - Cross-Field Chronology Rule: `invoice_date <= due_date`.
2. **Commercial Contract & NDA (`contract-v1`)**:
   - Fields: `agreement_title`, `parties`, `effective_date`, `expiration_date`, `governing_law`, `liability_cap`.
   - Cross-Field Chronology Rule: `effective_date <= expiration_date`.
3. **W-9 Taxpayer Form (`tax-form-w9`)**:
   - Fields: `taxpayer_name`, `business_name`, `tax_classification`, `tax_id_ein`, `address`, `certification_date`.

### Model Confidence vs. Validation Results
- **Model Confidence**: Quantitative heuristic/model probability score (0.00 – 1.00) reflecting extraction signal clarity.
- **Validation Status**: Independent deterministic verification (`VALID`, `INVALID`, `WARNING`). A field with high confidence (e.g., 99%) that violates a cross-field math rule is flagged with `INVALID` and transitions the job to `NEEDS_REVIEW`.

---

## 5. Human-in-the-Loop Review, Audit Trail & Exports

- **Field Correction**: Reviewers can correct any field via `PATCH /api/v1/review/jobs/:id/fields/:key`. Corrections record `previousValue`, `newValue`, mandatory `reason`, and reviewer `author`. Saving automatically re-evaluates schema rules and clears validation warnings once resolved.
- **Approval / Rejection**: Formal approval transitions status to `approved`, recording reviewer ID, timestamp, and decision notes.
- **Traceable Exports**: `GET /api/v1/export/jobs/:id?format=json` and `?format=csv` generate exports containing source traceability: `exportId`, `jobId`, `documentId`, `tenantId`, `schemaVersion`, `approvedBy`, and `approvedAt`.
- **Idempotency & Safe Retries**: Failed or needs-review jobs can be retried safely (`POST /api/v1/jobs/:id/retry`). Deduplication keys prevent duplicate alerts or corrupted exports.

---

## 6. Safe Natural-Language-to-SQL Module

The SQL module is constrained and independently authorized:
- **Authorization**: Caller must supply `x-sql-authorized: true` (or valid `SQL_ACCESS_SECRET`). Unauthorized requests receive `403 Forbidden`.
- **AST Parsing & Validation**: Uses `node-sql-parser` to inspect the Abstract Syntax Tree before any execution.
- **Single Read-Only `SELECT`**: Rejects DDL (`CREATE`, `DROP`, `ALTER`), DML (`INSERT`, `UPDATE`, `DELETE`), transaction control (`BEGIN`, `COMMIT`), and multi-statement queries (semicolon chaining).
- **Allowlisted Tables**: Only `documents`, `extraction_jobs`, and `extracted_records` are permitted. Queries referencing system catalogs (`pg_catalog`, `information_schema`) or arbitrary tables are rejected.
- **Disallowed Functions**: Blocks `pg_sleep`, `load_file`, `benchmark`, `eval`, and external execution commands. Allows only safe functions (`count`, `sum`, `avg`, `min`, `max`, `lower`, `upper`, `round`, `date`).
- **Tenant Scoping Enforcement**: Verifies the AST filters by `tenant_id` or binds the active tenant context. If tenant scoping cannot be proven, the query is rejected.
- **Bound Limits**: Automatically clamps queries to a maximum of 100 rows and enforces a 2000ms statement execution timeout.
- **Dry-Run / Explain Mode**: `POST /api/v1/sql/explain` returns the AST-verified SQL, target tables, and explanation without executing.

---

## 7. Deployment Configuration & Change Filtering

### Vercel (Frontend)
- **Root Directory**: `frontend/`
- **Framework**: `Next.js`
- **Build Command**: `npm run build`
- **Install Command**: `npm install`
- **Ignored Build Step**: Configure `scripts/vercel-ignore-build-step.sh` in Vercel project settings.
  - Returns exit code `1` (build) if `frontend/`, `scripts/`, or root configuration files changed.
  - Returns exit code `0` (skip) if only `backend/` files changed.
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: Backend production URL (e.g. `https://your-backend.onrender.com/api/v1`).
  - *No server secrets or database credentials are exposed to the frontend.*

### Render (Backend)
- **Root Directory**: `backend/`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod` (`node dist/main`)
- **Health Check Path**: `/health/readiness`
- **Render Deployment Filtering**: Render honors `rootDir: backend`. Changes confined to `frontend/` do not trigger backend rebuilds.
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `10000` (Render binds to `0.0.0.0:$PORT`)
  - `STORAGE_DIR`: `./uploads` (or mounted persistent disk)
  - `MAX_UPLOAD_BYTES`: `15728640`
  - `MAX_PAGE_COUNT`: `20`
  - `FEATURE_NL_SQL_ENABLED`: `true`
  - `SQL_STATEMENT_TIMEOUT_MS`: `2000`
  - `SQL_ACCESS_SECRET`: `secure-random-token`

---

## 8. Verification Results

### Backend
- **Unit Tests**: 5 test suites, 23 tests passed (`npm test` in `backend/`).
- **E2E Integration Tests**: 14 tests passed (`npm run test:e2e` in `backend/`).
- **Type Checking & Production Build**: NestJS compilation succeeded (`npm run build` in `backend/`).
- **Production Startup Smoke Test**: Verified `node dist/main` with `PORT=4010` answering `/`, `/health/liveness`, `/health/readiness`, and `/api/v1/capabilities`.

### Frontend
- **Type Checking**: Clean TypeScript validation with no emit errors (`npm run type-check` in `frontend/`).
- **Production Build**: Next.js 14 optimized build generated successfully with static page generation (`npm run build` in `frontend/`).

---

## 9. API Reference Contract

| Method | Route | Description | Auth / Guards |
|---|---|---|---|
| `GET` | `/` | Root service metadata and endpoint directory | None |
| `GET` | `/health/liveness` | Service liveness probe (200 OK) | None |
| `GET` | `/health/readiness` | Storage write & dependency readiness probe | None |
| `GET` | `/api/v1/capabilities` | Multimodal engine, SQL, and notification capabilities | None |
| `POST` | `/api/v1/documents/upload` | Multipart file upload with magic-byte validation | `TenantGuard` |
| `POST` | `/api/v1/documents/demo/seed` | Seed synthetic Invoice, Contract, and W-9 demo docs | `TenantGuard` |
| `GET` | `/api/v1/documents` | List ingested documents for tenant | `TenantGuard` |
| `GET` | `/api/v1/documents/:id` | Get document metadata | `TenantGuard` |
| `GET` | `/api/v1/documents/:id/content` | Stream authorized binary content | `TenantGuard` |
| `DELETE` | `/api/v1/documents/:id` | Soft or hard delete document & storage | `TenantGuard` |
| `GET` | `/api/v1/schemas` | List extraction schemas | `TenantGuard` |
| `GET` | `/api/v1/schemas/:id` | Get extraction schema definition | `TenantGuard` |
| `POST` | `/api/v1/schemas` | Register custom schema with cross-field rules | `TenantGuard` |
| `POST` | `/api/v1/jobs/extract` | Trigger schema extraction job | `TenantGuard` |
| `GET` | `/api/v1/jobs` | List extraction jobs for tenant | `TenantGuard` |
| `GET` | `/api/v1/jobs/:id` | Get job status, confidence, and linked evidence | `TenantGuard` |
| `POST` | `/api/v1/jobs/:id/retry` | Safe idempotent job retry | `TenantGuard` |
| `PATCH` | `/api/v1/review/jobs/:id/fields/:key` | Human field correction with audit logging | `TenantGuard` |
| `POST` | `/api/v1/review/jobs/:id/approve` | Approve extraction data | `TenantGuard` |
| `POST` | `/api/v1/review/jobs/:id/reject` | Reject extraction data | `TenantGuard` |
| `GET` | `/api/v1/review/jobs/:id/audit-trail` | Retrieve field correction audit history | `TenantGuard` |
| `GET` | `/api/v1/export/jobs/:id` | Export traceable JSON or CSV (`?format=csv`) | `TenantGuard` |
| `GET` | `/api/v1/sql/schema` | Allowlisted SQL schema catalog | `TenantGuard` |
| `POST` | `/api/v1/sql/explain` | Dry-run AST validation and human explanation | `TenantGuard` |
| `POST` | `/api/v1/sql/query` | Execute validated read-only SQL query | `TenantGuard`, `SqlAuthGuard` |

---

## 10. Local Development

```bash
# 1. Start the NestJS Backend
cd backend
npm install
npm run start:dev   # Runs on http://localhost:4000

# 2. Start the Next.js Frontend (in a separate terminal)
cd frontend
npm install
npm run dev         # Runs on http://localhost:3000
```
