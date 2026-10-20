import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SqlService } from './sql.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SqlAuthGuard } from '../../common/guards/sql-auth.guard';
import { SqlQueryDto, SqlExplainDto } from './dto/sql-query.dto';
import { TenantContext } from '../../common/types';

@Controller('sql')
@UseGuards(TenantGuard)
export class SqlController {
  constructor(private readonly sqlService: SqlService) {}

  @Get('schema')
  getSchema() {
    return this.sqlService.getSchema();
  }

  @Post('explain')
  explainQuery(@Body() dto: SqlExplainDto, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.sqlService.explainQuery(dto.query, tenantContext);
  }

  @Post('query')
  @UseGuards(SqlAuthGuard)
  executeQuery(@Body() dto: SqlQueryDto, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.sqlService.executeQuery(
      dto.naturalLanguageQuery,
      dto.explicitSql,
      !!dto.dryRun,
      tenantContext,
    );
  }
}
