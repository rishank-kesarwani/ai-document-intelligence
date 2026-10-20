import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { DocumentModality } from '../../../common/types';

export interface FileValidationResult {
  isValid: boolean;
  modality: DocumentModality;
  detectedMimeType: string;
  detectedExtension: string;
  pageCount: number;
}

export class MagicBytesUtil {
  /**
   * Verifies the file buffer content against known binary signatures (magic bytes).
   * Does NOT trust client Content-Type or file extension alone.
   */
  static validateContent(buffer: Buffer): { modality: DocumentModality; detectedMimeType: string; detectedExtension: string } {
    if (!buffer || buffer.length < 8) {
      throw new BadRequestException('Empty or corrupt file payload received');
    }

    // PDF signature: %PDF- (hex: 25 50 44 46 2D)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    ) {
      return {
        modality: DocumentModality.PDF,
        detectedMimeType: 'application/pdf',
        detectedExtension: 'pdf',
      };
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return {
        modality: DocumentModality.IMAGE,
        detectedMimeType: 'image/png',
        detectedExtension: 'png',
      };
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return {
        modality: DocumentModality.IMAGE,
        detectedMimeType: 'image/jpeg',
        detectedExtension: 'jpg',
      };
    }

    // WEBP signature: RIFF ... WEBP
    if (
      buffer.length >= 12 &&
      buffer.toString('utf8', 0, 4) === 'RIFF' &&
      buffer.toString('utf8', 8, 12) === 'WEBP'
    ) {
      return {
        modality: DocumentModality.IMAGE,
        detectedMimeType: 'image/webp',
        detectedExtension: 'webp',
      };
    }

    // Reject unsupported or spoofed files
    throw new UnsupportedMediaTypeException(
      'Unsupported file format or invalid magic bytes. Only PDF, PNG, JPEG, and WEBP documents are permitted.',
    );
  }

  /**
   * Fast page count inspection for PDF buffers
   */
  static estimatePdfPageCount(buffer: Buffer): number {
    try {
      const content = buffer.toString('binary');
      // Look for /Type /Page (and not /Pages)
      const pageMatches = content.match(/\/Type\s*\/Page\b/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }

      // Fallback: look for /Count in page tree
      const countMatch = content.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
      if (countMatch && countMatch[1]) {
        const parsed = parseInt(countMatch[1], 10);
        if (parsed > 0) return parsed;
      }
    } catch {
      // In case of error in fallback inspection
    }
    return 1;
  }
}
