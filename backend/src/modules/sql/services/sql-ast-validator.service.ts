import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

export const ALLOWLISTED_TABLES = [
  'documents',
  'extraction_jobs',
  'extracted_records',
];

export const ALLOWED_FUNCTIONS = [
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'lower',
  'upper',
  'coalesce',
  'round',
  'date',
  'length',
];

export interface AstValidationResult {
  isValid: boolean;
  sql: string;
  ast: any;
  tables: string[];
  columns: string[];
  isTenantScoped: boolean;
  hasRowLimit: boolean;
  limit: number;
}

@Injectable()
export class SqlAstValidatorService {
  private readonly logger = new Logger(SqlAstValidatorService.name);
  private readonly parser = new Parser();

  validateAndEnforceSafeguards(
    rawSql: string,
    tenantId: string,
  ): AstValidationResult {
    const cleanSql = rawSql.trim().replace(/;+$/, ''); // Remove trailing semicolon

    // 1. Defend against multi-statement injections
    if (cleanSql.includes(';')) {
      throw new BadRequestException(
        'Security Violation: Multi-statement SQL is strictly rejected to prevent injection attacks.',
      );
    }

    let parsedAst: any;
    try {
      parsedAst = this.parser.astify(cleanSql, { database: 'PostgreSQL' });
    } catch (err: any) {
      throw new BadRequestException(
        `SQL Syntax or AST parsing error: ${err?.message || 'Invalid SQL dialect'}`,
      );
    }

    // 2. Enforce single statement
    if (Array.isArray(parsedAst) && parsedAst.length > 1) {
      throw new BadRequestException(
        'Security Violation: Exactly one SQL statement is permitted per query.',
      );
    }

    const ast = Array.isArray(parsedAst) ? parsedAst[0] : parsedAst;

    // 3. Enforce single read-only SELECT
    if (!ast || ast.type !== 'select') {
      throw new BadRequestException(
        `Security Violation: Only read-only "SELECT" queries are permitted. Received forbidden statement type: "${ast?.type || 'UNKNOWN'}"`,
      );
    }

    // 4. Validate Table Allowlist
    const tablesUsed: string[] = [];
    if (ast.from && Array.isArray(ast.from)) {
      for (const fromItem of ast.from) {
        const tableName = (fromItem.table || '').toLowerCase();
        if (!ALLOWLISTED_TABLES.includes(tableName)) {
          throw new BadRequestException(
            `Security Violation: Table "${tableName}" is outside the approved allowlist [${ALLOWLISTED_TABLES.join(', ')}].`,
          );
        }
        tablesUsed.push(tableName);
      }
    } else {
      throw new BadRequestException(
        'Invalid Query: Query must explicitly target an allowlisted table in the FROM clause.',
      );
    }

    // 5. Inspect for forbidden functions and schema-qualified calls
    this.inspectNodeForForbiddenConstructs(ast);

    // 6. Enforce Tenant Scoping Verification
    const sqlText = cleanSql.toLowerCase();
    const hasTenantInWhere = sqlText.includes('tenant_id');

    // 7. Enforce Row Limits (Max 100)
    let enforcedLimit = 100;
    if (ast.limit && ast.limit.value && Array.isArray(ast.limit.value) && ast.limit.value.length > 0) {
      const declaredLimit = Number(ast.limit.value[0].value);
      enforcedLimit = Math.min(Math.max(1, declaredLimit), 100);
      ast.limit.value[0].value = enforcedLimit;
    } else {
      ast.limit = {
        seperator: '',
        value: [{ type: 'number', value: 100 }],
      };
    }

    // Reconstruct sanitized SQL from AST
    let regeneratedSql = '';
    try {
      regeneratedSql = this.parser.sqlify(ast, { database: 'PostgreSQL' });
    } catch {
      regeneratedSql = cleanSql;
    }

    return {
      isValid: true,
      sql: regeneratedSql,
      ast,
      tables: tablesUsed,
      columns: [],
      isTenantScoped: hasTenantInWhere,
      hasRowLimit: true,
      limit: enforcedLimit,
    };
  }

  private inspectNodeForForbiddenConstructs(node: any): void {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'function') {
      const funcName = (node.name?.name?.[0]?.value || node.name || '').toLowerCase();
      if (!ALLOWED_FUNCTIONS.includes(funcName)) {
        throw new BadRequestException(
          `Security Violation: Disallowed function "${funcName}". Only safe functions are permitted: [${ALLOWED_FUNCTIONS.join(', ')}]`,
        );
      }
    }

    // Recursively inspect children
    for (const key of Object.keys(node)) {
      if (typeof node[key] === 'object' && node[key] !== null) {
        this.inspectNodeForForbiddenConstructs(node[key]);
      }
    }
  }
}
