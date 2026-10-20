import { BadRequestException } from '@nestjs/common';
import { SqlAstValidatorService } from './sql-ast-validator.service';

describe('SqlAstValidatorService Safeguards', () => {
  let validator: SqlAstValidatorService;
  const testTenant = 'tenant-demo-default';

  beforeEach(() => {
    validator = new SqlAstValidatorService();
  });

  it('should accept valid read-only SELECT query against allowlisted table with tenant filter', () => {
    const query = `SELECT id, original_filename FROM documents WHERE tenant_id = '${testTenant}' LIMIT 10`;
    const result = validator.validateAndEnforceSafeguards(query, testTenant);
    expect(result.isValid).toBe(true);
    expect(result.tables).toContain('documents');
    expect(result.isTenantScoped).toBe(true);
    expect(result.limit).toBe(10);
  });

  it('should reject multiple statements to prevent SQL injection', () => {
    const maliciousQuery = `SELECT * FROM documents WHERE tenant_id = '${testTenant}'; DROP TABLE documents;`;
    expect(() => validator.validateAndEnforceSafeguards(maliciousQuery, testTenant)).toThrow(
      BadRequestException,
    );
  });

  it('should reject DDL and DML statements (INSERT, UPDATE, DELETE, DROP)', () => {
    const insertQuery = `INSERT INTO documents (id, tenant_id) VALUES ('123', '${testTenant}')`;
    expect(() => validator.validateAndEnforceSafeguards(insertQuery, testTenant)).toThrow(
      BadRequestException,
    );

    const dropQuery = `DROP TABLE documents`;
    expect(() => validator.validateAndEnforceSafeguards(dropQuery, testTenant)).toThrow(
      BadRequestException,
    );

    const deleteQuery = `DELETE FROM documents WHERE tenant_id = '${testTenant}'`;
    expect(() => validator.validateAndEnforceSafeguards(deleteQuery, testTenant)).toThrow(
      BadRequestException,
    );
  });

  it('should reject unapproved tables outside allowlist', () => {
    const query = `SELECT * FROM users WHERE tenant_id = '${testTenant}'`;
    expect(() => validator.validateAndEnforceSafeguards(query, testTenant)).toThrow(
      BadRequestException,
    );

    const sysQuery = `SELECT * FROM pg_catalog.pg_tables WHERE tenant_id = '${testTenant}'`;
    expect(() => validator.validateAndEnforceSafeguards(sysQuery, testTenant)).toThrow(
      BadRequestException,
    );
  });

  it('should reject unsafe functions such as pg_sleep or system execution', () => {
    const sleepQuery = `SELECT pg_sleep(10) FROM documents WHERE tenant_id = '${testTenant}'`;
    expect(() => validator.validateAndEnforceSafeguards(sleepQuery, testTenant)).toThrow(
      BadRequestException,
    );
  });

  it('should automatically clamp row limit to maximum 100 rows', () => {
    const excessiveLimitQuery = `SELECT id FROM documents WHERE tenant_id = '${testTenant}' LIMIT 5000`;
    const result = validator.validateAndEnforceSafeguards(excessiveLimitQuery, testTenant);
    expect(result.limit).toBe(100);
  });
});
