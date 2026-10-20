import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ExtractionService } from '../extraction/extraction.service';
import { TenantContext } from '../../common/types';

@Injectable()
export class ExportService {
  constructor(private readonly extractionService: ExtractionService) {}

  async exportJob(
    jobId: string,
    tenantContext: TenantContext,
    format: 'json' | 'csv' = 'json',
  ): Promise<{ data: string; contentType: string; filename: string }> {
    const job = await this.extractionService.getJobById(jobId, tenantContext.tenantId);

    const exportId = uuidv4();
    const exportedAt = new Date().toISOString();

    const dataMap: Record<string, any> = {};
    const evidenceMap: Record<string, any> = {};

    for (const field of job.fields) {
      dataMap[field.key] = field.value;
      if (field.evidence) {
        evidenceMap[field.key] = {
          pageNumber: field.evidence.pageNumber,
          snippet: field.evidence.snippet,
          boundingBox: field.evidence.boundingBox,
        };
      }
    }

    const payload = {
      exportMetadata: {
        exportId,
        exportedAt,
        jobId: job.id,
        documentId: job.documentId,
        tenantId: job.tenantId,
        schemaId: job.schemaId,
        schemaVersion: job.schemaVersion,
        status: job.status,
        overallConfidence: job.overallConfidence,
        decision: job.decision || null,
      },
      extractedData: dataMap,
      evidenceReferences: evidenceMap,
    };

    job.approvalExported = true;
    this.extractionService.saveJob(job);

    if (format === 'csv') {
      const csv = this.formatAsCsv(payload);
      return {
        data: csv,
        contentType: 'text/csv',
        filename: `export-${job.schemaId}-${job.id.substring(0, 8)}.csv`,
      };
    }

    return {
      data: JSON.stringify(payload, null, 2),
      contentType: 'application/json',
      filename: `export-${job.schemaId}-${job.id.substring(0, 8)}.json`,
    };
  }

  private formatAsCsv(payload: any): string {
    const meta = payload.exportMetadata;
    const data = payload.extractedData;

    const headers = [
      'exportId',
      'exportedAt',
      'jobId',
      'documentId',
      'tenantId',
      'schemaId',
      'status',
      'approvedBy',
      'approvedAt',
      ...Object.keys(data),
    ];

    const escapeCsvValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rowValues = [
      meta.exportId,
      meta.exportedAt,
      meta.jobId,
      meta.documentId,
      meta.tenantId,
      meta.schemaId,
      meta.status,
      meta.decision?.reviewerId || '',
      meta.decision?.timestamp || '',
      ...Object.values(data),
    ];

    return [
      headers.map(escapeCsvValue).join(','),
      rowValues.map(escapeCsvValue).join(','),
    ].join('\n');
  }
}
