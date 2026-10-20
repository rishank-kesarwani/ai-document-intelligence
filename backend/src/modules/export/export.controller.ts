import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ExportService } from './export.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantContext } from '../../common/types';

@Controller('export')
@UseGuards(TenantGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('jobs/:id')
  async exportJob(
    @Param('id') jobId: string,
    @Query('format') format: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    const formatType = format === 'csv' ? 'csv' : 'json';
    const result = await this.exportService.exportJob(jobId, tenantContext, formatType);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }
}
