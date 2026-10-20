import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { DocumentsService } from './documents.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UploadDocumentDto, DeleteDocumentQueryDto } from './dto/upload-document.dto';
import { TenantContext } from '../../common/types';

@Controller('documents')
@UseGuards(TenantGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB max payload limit
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.documentsService.uploadDocument(
      file,
      tenantContext,
      dto.retentionDays,
      dto.documentType ? { documentType: dto.documentType } : undefined,
    );
  }

  @Post('demo/seed')
  @HttpCode(HttpStatus.OK)
  async seedDemoDocuments(@Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.documentsService.seedDemoDocuments(tenantContext);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.documentsService.findAll(tenantContext.tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.documentsService.findById(id, tenantContext.tenantId);
  }

  @Get(':id/content')
  async getDocumentContent(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    const { buffer, doc } = await this.documentsService.getFileBuffer(id, tenantContext.tenantId);

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalFilename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  async deleteDocument(
    @Param('id') id: string,
    @Query() query: DeleteDocumentQueryDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    const isHard = query.hard === 'true';
    return this.documentsService.deleteDocument(id, tenantContext.tenantId, isHard);
  }
}
