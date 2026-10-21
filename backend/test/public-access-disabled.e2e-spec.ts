import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Public Access Disabled Policy (E2E)', () => {
  let app: INestApplication;
  const originalEnv = process.env.PUBLIC_ACCESS_ENABLED;

  beforeAll(async () => {
    process.env.PUBLIC_ACCESS_ENABLED = 'false';

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
    if (originalEnv !== undefined) {
      process.env.PUBLIC_ACCESS_ENABLED = originalEnv;
    } else {
      delete process.env.PUBLIC_ACCESS_ENABLED;
    }
  });

  describe('Capabilities Discovery', () => {
    it('GET /api/v1/capabilities should report publicAccess.enabled as false', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/capabilities')
        .expect(200);

      expect(res.body.publicAccess).toBeDefined();
      expect(res.body.publicAccess.enabled).toBe(false);
      expect(res.body.publicAccess.policy).toBe(
        'Public demo functionality disabled (authenticated tenant required)',
      );
    });
  });

  describe('Demo Seeding Route Protection', () => {
    it('POST /api/v1/documents/demo/seed should be rejected (403 Forbidden) even with tenant header', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/documents/demo/seed')
        .set('x-tenant-id', 'tenant-custom-org')
        .expect(403);

      expect(res.body.message).toContain('Public demo access is disabled by server policy');
    });
  });

  describe('Tenant Isolation & Unauthenticated Request Rejection', () => {
    it('GET /api/v1/documents without x-tenant-id should be rejected with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .expect(401);

      expect(res.body.message).toContain('Tenant identifier is required');
    });

    it('GET /api/v1/documents with tenant-demo-default should be rejected with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('x-tenant-id', 'tenant-demo-default')
        .expect(403);

      expect(res.body.message).toContain('Access to default demo tenant is disabled');
    });

    it('GET /api/v1/documents with valid authorized tenant should succeed with 200 OK', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/documents')
        .set('x-tenant-id', 'tenant-enterprise-prod')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/v1/sql/query without tenant should fail with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sql/query')
        .send({ naturalLanguageQuery: 'Show documents' })
        .expect(401);
    });

    it('POST /api/v1/sql/query with tenant but without x-sql-authorized should fail with 403', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sql/query')
        .set('x-tenant-id', 'tenant-enterprise-prod')
        .send({ naturalLanguageQuery: 'Show documents' })
        .expect(403);
    });
  });
});
