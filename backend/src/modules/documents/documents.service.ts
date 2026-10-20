import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../shared-services/storage.service';
import { DocumentEntity } from './entities/document.entity';
import { MagicBytesUtil } from './utils/magic-bytes.util';
import { SyntheticDocumentsUtil } from './utils/synthetic-documents.util';
import { DocumentModality, TenantContext } from '../../common/types';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly documents = new Map<string, DocumentEntity>();

  private readonly maxUploadBytes: number;
  private readonly maxPageCount: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.maxUploadBytes = parseInt(
      this.configService.get<string>('MAX_UPLOAD_BYTES', `${15 * 1024 * 1024}`),
      10,
    );
    this.maxPageCount = parseInt(
      this.configService.get<string>('MAX_PAGE_COUNT', '20'),
      10,
    );
  }

  async uploadDocument(
    file: Express.Multer.File,
    tenantContext: TenantContext,
    retentionDays?: number,
    metadata?: Record<string, any>,
  ): Promise<DocumentEntity> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file content uploaded');
    }

    // 1. Enforce size limits
    if (file.buffer.length > this.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `File size (${(file.buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${(
          this.maxUploadBytes /
          (1024 * 1024)
        ).toFixed(2)} MB`,
      );
    }

    // 2. Validate magic bytes (do not trust client mimetype)
    const { modality, detectedMimeType, detectedExtension } =
      MagicBytesUtil.validateContent(file.buffer);

    // 3. Page count calculation & limits
    let pageCount = 1;
    if (modality === DocumentModality.PDF) {
      pageCount = MagicBytesUtil.estimatePdfPageCount(file.buffer);
      if (pageCount > this.maxPageCount) {
        throw new BadRequestException(
          `Document page count (${pageCount}) exceeds maximum permissible limit of ${this.maxPageCount} pages`,
        );
      }
    }

    // 4. Save to secure storage with UUID key
    const sanitizedOriginal = (file.originalname || `upload.${detectedExtension}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);

    const { storageKey, byteSize } = await this.storageService.saveFile(
      sanitizedOriginal,
      file.buffer,
      detectedMimeType,
    );

    const docId = uuidv4();
    const now = new Date();
    let retentionExpiresAt: string | undefined;
    if (retentionDays && retentionDays > 0) {
      const exp = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
      retentionExpiresAt = exp.toISOString();
    }

    const doc: DocumentEntity = {
      id: docId,
      tenantId: tenantContext.tenantId,
      originalFilename: sanitizedOriginal,
      storageKey,
      modality,
      mimeType: detectedMimeType,
      byteSize,
      pageCount,
      uploadedAt: now.toISOString(),
      isDemo: tenantContext.isDemo || !!metadata?.isDemo,
      retentionExpiresAt,
      isDeleted: false,
      metadata: metadata || {},
    };

    this.documents.set(doc.id, doc);
    this.logger.log(
      `Document uploaded successfully: ID ${doc.id} (${doc.originalFilename}, ${doc.byteSize} bytes, ${doc.pageCount} pages, Tenant: ${doc.tenantId})`,
    );

    return doc;
  }

  async seedDemoDocuments(tenantContext: TenantContext): Promise<DocumentEntity[]> {
    const samples = [
      SyntheticDocumentsUtil.getSampleInvoice(),
      SyntheticDocumentsUtil.getSampleContract(),
      SyntheticDocumentsUtil.getSampleTaxForm(),
    ];

    const seeded: DocumentEntity[] = [];

    for (const sample of samples) {
      const mockMulterFile: Express.Multer.File = {
        buffer: sample.buffer,
        originalname: sample.filename,
        mimetype: 'application/pdf',
        size: sample.buffer.length,
        fieldname: 'file',
        encoding: '7bit',
        destination: '',
        filename: sample.filename,
        path: '',
        stream: null as any,
      };

      const doc = await this.uploadDocument(
        mockMulterFile,
        tenantContext,
        30, // 30 days retention for demo data
        { isDemo: true, ...sample.metadata },
      );
      seeded.push(doc);
    }

    return seeded;
  }

  async findAll(tenantId: string, includeDeleted = false): Promise<DocumentEntity[]> {
    const list: DocumentEntity[] = [];
    for (const doc of this.documents.values()) {
      if (doc.tenantId === tenantId && (includeDeleted || !doc.isDeleted)) {
        list.push(doc);
      }
    }
    return list.sort((a, b) => (b.uploadedAt > a.uploadedAt ? 1 : -1));
  }

  async findById(id: string, tenantId: string): Promise<DocumentEntity> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new NotFoundException(`Document with ID "${id}" was not found`);
    }

    // Strict tenant boundary enforcement
    if (doc.tenantId !== tenantId) {
      throw new ForbiddenException(`Access denied: Document does not belong to your tenant`);
    }

    if (doc.isDeleted) {
      throw new NotFoundException(`Document with ID "${id}" has been deleted`);
    }

    return doc;
  }

  async getFileBuffer(id: string, tenantId: string): Promise<{ buffer: Buffer; doc: DocumentEntity }> {
    const doc = await this.findById(id, tenantId);
    const buffer = await this.storageService.getFileBuffer(doc.storageKey);
    return { buffer, doc };
  }

  async deleteDocument(
    id: string,
    tenantId: string,
    hardDelete = false,
  ): Promise<{ success: boolean; message: string }> {
    const doc = this.documents.get(id);
    if (!doc) {
      throw new NotFoundException(`Document with ID "${id}" was not found`);
    }

    if (doc.tenantId !== tenantId) {
      throw new ForbiddenException(`Access denied: Document does not belong to your tenant`);
    }

    if (hardDelete) {
      await this.storageService.deleteFile(doc.storageKey);
      this.documents.delete(id);
      this.logger.log(`Hard deleted document ${id} for tenant ${tenantId}`);
      return { success: true, message: `Document ${id} permanently deleted` };
    } else {
      doc.isDeleted = true;
      this.logger.log(`Soft deleted document ${id} for tenant ${tenantId}`);
      return { success: true, message: `Document ${id} marked as deleted` };
    }
  }

  // Get raw documents map for internal modules (e.g. safe SQL module queries)
  getAllDocumentsForTenant(tenantId: string): DocumentEntity[] {
    return Array.from(this.documents.values()).filter(
      (d) => d.tenantId === tenantId && !d.isDeleted,
    );
  }
}
