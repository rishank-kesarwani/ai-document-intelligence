import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private storageDirectory: string;

  constructor(private readonly configService: ConfigService) {
    const rawDir = this.configService.get<string>('STORAGE_DIR', './uploads');
    this.storageDirectory = path.resolve(rawDir);
  }

  onModuleInit(): void {
    if (!fs.existsSync(this.storageDirectory)) {
      fs.mkdirSync(this.storageDirectory, { recursive: true });
      this.logger.log(`Created storage directory at ${this.storageDirectory}`);
    }
  }

  async saveFile(
    originalFilename: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ storageKey: string; byteSize: number; extension: string }> {
    // Sanitize extension and generate random UUID filename to prevent path traversal
    const extMatch = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
    let extension = extMatch ? extMatch[1].toLowerCase() : 'bin';
    if (mimeType === 'application/pdf') extension = 'pdf';
    else if (mimeType === 'image/png') extension = 'png';
    else if (mimeType === 'image/jpeg') extension = 'jpg';
    else if (mimeType === 'image/webp') extension = 'webp';

    const safeStorageKey = `${uuidv4()}.${extension}`;
    const destinationPath = path.resolve(this.storageDirectory, safeStorageKey);

    // Verify destination does not escape storage directory (Path Traversal defense)
    if (!destinationPath.startsWith(this.storageDirectory)) {
      throw new Error('Security Violation: Path traversal detected during file storage');
    }

    await fs.promises.writeFile(destinationPath, buffer);
    return {
      storageKey: safeStorageKey,
      byteSize: buffer.length,
      extension,
    };
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const safeKey = path.basename(storageKey);
    const resolvedPath = path.resolve(this.storageDirectory, safeKey);

    if (!resolvedPath.startsWith(this.storageDirectory) || !fs.existsSync(resolvedPath)) {
      throw new Error(`Document storage file not found or unauthorized`);
    }

    return fs.promises.readFile(resolvedPath);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const resolvedPath = path.resolve(this.storageDirectory, safeKey);

    if (resolvedPath.startsWith(this.storageDirectory) && fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
      return true;
    }
    return false;
  }

  checkHealth(): { isHealthy: boolean; storagePath: string; details?: string } {
    try {
      const testFile = path.join(this.storageDirectory, `.probe-${Date.now()}`);
      fs.writeFileSync(testFile, 'probe');
      fs.unlinkSync(testFile);
      return { isHealthy: true, storagePath: this.storageDirectory };
    } catch (err: any) {
      return {
        isHealthy: false,
        storagePath: this.storageDirectory,
        details: err?.message || 'Storage write test failed',
      };
    }
  }
}
