import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SchemasService } from './schemas.service';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { TenantContext } from '../../common/types';

@Controller('schemas')
@UseGuards(TenantGuard)
export class SchemasController {
  constructor(private readonly schemasService: SchemasService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.schemasService.findAll(tenantContext.tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.schemasService.findById(id, tenantContext.tenantId);
  }

  @Post()
  async create(@Body() dto: CreateSchemaDto, @Req() req: Request) {
    const tenantContext: TenantContext = (req as any).tenantContext;
    return this.schemasService.create(dto, tenantContext.tenantId);
  }
}
