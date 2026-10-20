import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { StorageService } from '../shared-services/storage.service';
import { MagicBytesUtil } from './utils/magic-bytes.util';
import { SyntheticDocumentsUtil } from './utils/synthetic-documents.util';
import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { TenantContext } from '../../common/types';

describe('DocumentsService & Security', () => {
  let service: DocumentsService;
  let storageService: StorageService;

  const mockTenantContext: TenantContext = {
    tenantId: 'tenant-test-1',
    isDemo: false,
    isSqlAuthorized: false,
  };

  const otherTenantContext: TenantContext = {
    tenantId: 'tenant-test-2',
    isDemo: false,
    isSqlAuthorized: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              if (key === 'MAX_UPLOAD_BYTES') return '1048576'; // 1 MB for testing
              if (key === 'MAX_PAGE_COUNT') return '5';
              return defaultValue;
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            saveFile: jest.fn().mockResolvedValue({
              storageKey: 'mock-uuid-key.pdf',
              byteSize: 1024,
              extension: 'pdf',
            }),
            getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock content')),
            deleteFile: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    storageService = module.get<StorageService>(StorageService);
  });

  describe('Magic Byte Content Verification', () => {
    it('should successfully detect valid PDF magic bytes', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 sample file content');
      const result = MagicBytesUtil.validateContent(pdfBuffer);
      expect(result.detectedMimeType).toBe('application/pdf');
      expect(result.detectedExtension).toBe('pdf');
    });

    it('should successfully detect valid PNG magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = MagicBytesUtil.validateContent(pngBuffer);
      expect(result.detectedMimeType).toBe('image/png');
    });

    it('should reject spoofed files with invalid magic bytes (e.g. executable disguised as .pdf)', () => {
      const badBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 binary exe');
      expect(() => MagicBytesUtil.validateContent(badBuffer)).toThrow(UnsupportedMediaTypeException);
    });

    it('should reject empty or undersized buffers', () => {
      const emptyBuffer = Buffer.from('');
      expect(() => MagicBytesUtil.validateContent(emptyBuffer)).toThrow(BadRequestException);
    });
  });

  describe('File Size and Page Count Limits', () => {
    it('should reject uploads exceeding MAX_UPLOAD_BYTES', async () => {
      const oversizedBuffer = Buffer.alloc(2 * 1024 * 1024); // 2 MB > 1 MB limit
      oversizedBuffer.write('%PDF-1.4');

      const mockFile = {
        buffer: oversizedBuffer,
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: oversizedBuffer.length,
      } as Express.Multer.File;

      await expect(service.uploadDocument(mockFile, mockTenantContext)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('should seed synthetic demonstration documents correctly', async () => {
      const docs = await service.seedDemoDocuments(mockTenantContext);
      expect(docs.length).toBe(3);
      expect(docs.every((d) => d.isDemo)).toBe(true);
      expect(docs.every((d) => d.tenantId === mockTenantContext.tenantId)).toBe(true);
    });
  });

  describe('Tenant Isolation Boundaries', () => {
    it('should strictly deny access when requesting a document from another tenant', async () => {
      const sample = SyntheticDocumentsUtil.getSampleInvoice();
      const mockFile = {
        buffer: sample.buffer,
        originalname: 'invoice.pdf',
        mimetype: 'application/pdf',
        size: sample.buffer.length,
      } as Express.Multer.File;

      const doc = await service.uploadDocument(mockFile, mockTenantContext);
      expect(doc.id).toBeDefined();

      // Tenant 1 can read
      const found = await service.findById(doc.id, mockTenantContext.tenantId);
      expect(found.id).toBe(doc.id);

      // Tenant 2 must be rejected with ForbiddenException
      await expect(service.findById(doc.id, otherTenantContext.tenantId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Retention and Deletion Controls', () => {
    it('should support soft and hard deletion', async () => {
      const sample = SyntheticDocumentsUtil.getSampleContract();
      const mockFile = {
        buffer: sample.buffer,
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: sample.buffer.length,
      } as Express.Multer.File;

      const doc = await service.uploadDocument(mockFile, mockTenantContext);

      // Soft delete
      const softRes = await service.deleteDocument(doc.id, mockTenantContext.tenantId, false);
      expect(softRes.success).toBe(true);

      // Accessing soft-deleted document should return NotFoundException
      await expect(service.findById(doc.id, mockTenantContext.tenantId)).rejects.toThrow();

      // Hard delete
      const hardRes = await service.deleteDocument(doc.id, mockTenantContext.tenantId, true);
      expect(hardRes.success).toBe(true);
      expect(storageService.deleteFile).toHaveBeenCalledWith(doc.storageKey);
    });
  });
});
