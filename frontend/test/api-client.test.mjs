import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/lib/api.ts';

describe('Frontend ApiClient Configuration and URL Normalization', () => {
  it('should default baseUrl to http://localhost:4000/api/v1', () => {
    const origUrl = process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    const client = new ApiClient();
    assert.equal(client.getBaseUrl(), 'http://localhost:4000/api/v1');

    if (origUrl !== undefined) process.env.NEXT_PUBLIC_API_URL = origUrl;
  });

  it('should strip trailing slashes and ensure /api/v1 is appended once if omitted in NEXT_PUBLIC_API_URL', () => {
    const origUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://ai-doc-intel.onrender.com///';

    const client = new ApiClient();
    assert.equal(client.getBaseUrl(), 'https://ai-doc-intel.onrender.com/api/v1');

    if (origUrl !== undefined) process.env.NEXT_PUBLIC_API_URL = origUrl;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('should retain single /api/v1 if NEXT_PUBLIC_API_URL already contains /api/v1 with trailing slash', () => {
    const origUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://ai-doc-intel.onrender.com/api/v1/';

    const client = new ApiClient();
    assert.equal(client.getBaseUrl(), 'https://ai-doc-intel.onrender.com/api/v1');

    if (origUrl !== undefined) process.env.NEXT_PUBLIC_API_URL = origUrl;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('normalizeUrl()', () => {
    it('should construct full URL from relative path with leading slash', () => {
      const client = new ApiClient();
      assert.equal(
        client.normalizeUrl('/documents'),
        `${client.getBaseUrl()}/documents`,
      );
    });

    it('should handle paths without leading slash', () => {
      const client = new ApiClient();
      assert.equal(
        client.normalizeUrl('schemas'),
        `${client.getBaseUrl()}/schemas`,
      );
    });

    it('should deduplicate /api/v1 if caller accidentally includes /api/v1 prefix', () => {
      const client = new ApiClient();
      assert.equal(
        client.normalizeUrl('/api/v1/documents'),
        `${client.getBaseUrl()}/documents`,
      );
      assert.doesNotMatch(client.normalizeUrl('/api/v1/documents'), /\/api\/v1\/api\/v1/);
    });

    it('should correctly normalize /api/v1 root endpoint', () => {
      const client = new ApiClient();
      assert.equal(client.normalizeUrl('/api/v1'), client.getBaseUrl());
    });
  });

  describe('Public Access and Demo Flag Policies', () => {
    it('should enable public access by default when NEXT_PUBLIC_ACCESS_ENABLED is unset', () => {
      const origFlag = process.env.NEXT_PUBLIC_ACCESS_ENABLED;
      delete process.env.NEXT_PUBLIC_ACCESS_ENABLED;

      const client = new ApiClient();
      assert.equal(client.isPublicAccessEnabled(), true);
      assert.equal(client.isDemoMode(), true);

      if (origFlag !== undefined) process.env.NEXT_PUBLIC_ACCESS_ENABLED = origFlag;
    });

    it('should disable public access when NEXT_PUBLIC_ACCESS_ENABLED is "false"', () => {
      const origFlag = process.env.NEXT_PUBLIC_ACCESS_ENABLED;
      process.env.NEXT_PUBLIC_ACCESS_ENABLED = 'false';

      const client = new ApiClient();
      assert.equal(client.isPublicAccessEnabled(), false);
      assert.equal(client.isDemoMode(), false);

      if (origFlag !== undefined) process.env.NEXT_PUBLIC_ACCESS_ENABLED = origFlag;
      else delete process.env.NEXT_PUBLIC_ACCESS_ENABLED;
    });

    it('should respect custom NEXT_PUBLIC_DEFAULT_TENANT_ID', () => {
      const origTenant = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
      process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID = 'tenant-enterprise-vault';

      const client = new ApiClient();
      assert.equal(client.getDefaultTenantId(), 'tenant-enterprise-vault');
      assert.equal(client.getTenantId(), 'tenant-enterprise-vault');

      if (origTenant !== undefined) process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID = origTenant;
      else delete process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
    });
  });

  describe('Document Download URL Helper', () => {
    it('should point to /documents/:id/content with exactly one /api/v1 prefix and tenant query', () => {
      const client = new ApiClient();
      const contentUrl = client.getDocumentContentUrl('doc-test-uuid');
      assert.equal(
        contentUrl,
        `${client.getBaseUrl()}/documents/doc-test-uuid/content?tenantId=${client.getTenantId()}`,
      );
    });
  });

  describe('ApiError structure', () => {
    it('should correctly store status code, errorType, and correlation ID', () => {
      const err = new ApiError('Tenant access forbidden', 403, 'ForbiddenException', 'req-corr-1234');
      assert.equal(err.name, 'ApiError');
      assert.equal(err.message, 'Tenant access forbidden');
      assert.equal(err.statusCode, 403);
      assert.equal(err.errorType, 'ForbiddenException');
      assert.equal(err.correlationId, 'req-corr-1234');
      assert.equal(err instanceof Error, true);
    });
  });
});
