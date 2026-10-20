import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Document Intelligence E2E API Flow', () => {
  let app: INestApplication;
  const tenantId = 'tenant-e2e-flow';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1', {
      exclude: ['/', 'health/liveness', 'health/readiness'],
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Root and Health Routes', () => {
    it('GET / should return root metadata without prefix requirement', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.body.service).toContain('Document Intelligence');
      expect(res.body.status).toBe('operational');
    });

    it('GET /health/liveness should return UP', async () => {
      const res = await request(app.getHttpServer()).get('/health/liveness').expect(200);
      expect(res.body.status).toBe('UP');
    });

    it('GET /health/readiness should return READY with storage checks', async () => {
      const res = await request(app.getHttpServer()).get('/health/readiness').expect(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.checks.storage.status).toBe('UP');
    });

    it('GET /api/v1/capabilities should return modality capabilities', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/capabilities').expect(200);
      expect(res.body.modalities.pdf.supported).toBe(true);
      expect(res.body.naturalLanguageSql.enabled).toBe(true);
    });
  });

  describe('Full Document & Extraction Pipeline', () => {
    let seededDocs: any[];
    let invoiceJobId: string;

    it('POST /api/v1/documents/demo/seed should seed demo documents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents/demo/seed')
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      seededDocs = res.body;
    });

    it('GET /api/v1/schemas should return default schemas', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/schemas')
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.some((s: any) => s.id === 'invoice-v1')).toBe(true);
      expect(res.body.some((s: any) => s.id === 'contract-v1')).toBe(true);
    });

    it('POST /api/v1/jobs/extract should trigger extraction and link evidence', async () => {
      const invoiceDoc = seededDocs.find((d: any) => d.originalFilename.includes('invoice'));
      expect(invoiceDoc).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/v1/jobs/extract')
        .set('x-tenant-id', tenantId)
        .send({
          documentId: invoiceDoc.id,
          schemaId: 'invoice-v1',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.documentId).toBe(invoiceDoc.id);
      expect(res.body.status).toBeDefined();
      expect(Array.isArray(res.body.fields)).toBe(true);

      // Verify evidence linkage
      const totalField = res.body.fields.find((f: any) => f.key === 'total_amount');
      expect(totalField).toBeDefined();
      expect(totalField.evidence).toBeDefined();
      expect(totalField.evidence.pageNumber).toBe(1);
      expect(totalField.evidence.snippet).toBeDefined();
      expect(totalField.evidence.boundingBox).toBeDefined();

      invoiceJobId = res.body.id;
    });

    it('PATCH /api/v1/review/jobs/:id/fields/:fieldKey should allow human correction and audit log', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/review/jobs/${invoiceJobId}/fields/payment_status`)
        .set('x-tenant-id', tenantId)
        .send({
          newValue: 'PAID',
          reason: 'Verified bank wire confirmation',
          author: 'finance-lead@company.com',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.auditRecord.newValue).toBe('PAID');
    });

    it('POST /api/v1/review/jobs/:id/approve should approve the job', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/review/jobs/${invoiceJobId}/approve`)
        .set('x-tenant-id', tenantId)
        .send({
          reviewerId: 'finance-lead',
          notes: 'Invoice verified and approved for ERP export',
        })
        .expect(201);

      expect(res.body.status).toBe('approved');
      expect(res.body.decision.reviewerId).toBe('finance-lead');
    });

    it('GET /api/v1/export/jobs/:id should export traceable JSON with source IDs', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/export/jobs/${invoiceJobId}?format=json`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.body.exportMetadata.jobId).toBe(invoiceJobId);
      expect(res.body.exportMetadata.status).toBe('approved');
      expect(res.body.extractedData).toBeDefined();
      expect(res.body.evidenceReferences).toBeDefined();
    });

    it('GET /api/v1/export/jobs/:id should export traceable CSV format', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/export/jobs/${invoiceJobId}?format=csv`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toContain('exportId');
      expect(res.text).toContain('invoice_number');
    });
  });

  describe('Safe Natural Language to SQL Safeguards', () => {
    it('POST /api/v1/sql/explain should explain natural language query without executing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sql/explain')
        .set('x-tenant-id', tenantId)
        .send({
          query: 'Show total count of documents',
        })
        .expect(201);

      expect(res.body.generatedSql.toLowerCase()).toContain('select count(*)');
      expect(res.body.safetyAudit.readOnlySelect).toBe(true);
      expect(res.body.tablesQueried).toContain('documents');
    });

    it('POST /api/v1/sql/query should be rejected (403 Forbidden) without SQL authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sql/query')
        .set('x-tenant-id', tenantId)
        // Missing x-sql-authorized: true
        .send({
          naturalLanguageQuery: 'Show total count of documents',
        })
        .expect(403);
    });

    it('POST /api/v1/sql/query should succeed when x-sql-authorized: true is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/sql/query')
        .set('x-tenant-id', tenantId)
        .set('x-sql-authorized', 'true')
        .send({
          naturalLanguageQuery: 'Show total count of documents',
        })
        .expect(201);

      expect(res.body.rows).toBeDefined();
      expect(res.body.rowCount).toBeGreaterThanOrEqual(1);
      expect(res.body.tenantId).toBe(tenantId);
    });
  });
});
