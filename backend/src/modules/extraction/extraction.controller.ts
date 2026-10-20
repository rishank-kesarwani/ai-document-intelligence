import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ExtractionService } from './extraction.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TriggerExtractionDto, RetryJobDto } from './dto/trigger-extraction.dto';
import { TenantContext } from '../../common/types';

@Controller('jobs')
@UseGuards(TenantGuard)
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  @Post('extract')
  async triggerExtraction(
    @Body() dto: TriggerExtractionDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.extractionService.triggerExtraction(dto, tenantContext);
  }

  @Post(':id/retry')
  async retryJob(
    @Param('id') id: string,
    @Body() dto: RetryJobDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.extractionService.retryJob(id, tenantContext);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.extractionService.findAllJobs(tenantContext.tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.extractionService.getJobById(id, tenantContext.tenantId);
  }
}
