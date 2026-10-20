import {
  Controller,
  Patch,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ReviewService } from './review.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { UpdateFieldDto, ReviewDecisionDto } from './dto/update-field.dto';
import { TenantContext } from '../../common/types';

@Controller('review')
@UseGuards(TenantGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Patch('jobs/:id/fields/:fieldKey')
  async updateField(
    @Param('id') jobId: string,
    @Param('fieldKey') fieldKey: string,
    @Body() dto: UpdateFieldDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.reviewService.updateField(jobId, fieldKey, dto, tenantContext);
  }

  @Post('jobs/:id/approve')
  async approveJob(
    @Param('id') jobId: string,
    @Body() dto: ReviewDecisionDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.reviewService.approveJob(jobId, dto, tenantContext);
  }

  @Post('jobs/:id/reject')
  async rejectJob(
    @Param('id') jobId: string,
    @Body() dto: ReviewDecisionDto,
    @Req() req: Request,
  ) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.reviewService.rejectJob(jobId, dto, tenantContext);
  }

  @Get('jobs/:id/audit-trail')
  async getAuditTrail(@Param('id') jobId: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.reviewService.getAuditTrail(jobId, tenantContext);
  }
}
