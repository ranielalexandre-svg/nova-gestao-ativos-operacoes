import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpsertContractBillingDto } from './dto/contract-billing.dto';
import { CreateContractContactDto } from './dto/contract-contact.dto';
import { CreateContractServiceDto } from './dto/contract-service.dto';
import { CreateContractUnitDto } from './dto/contract-unit.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractsService } from './contracts.service';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listContracts(@Query() query: ListContractsQueryDto) {
    return this.contractsService.listContracts(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getContractById(@Param('id') id: string) {
    return this.contractsService.getContractById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  createContract(@Body() body: CreateContractDto) {
    return this.contractsService.createContract(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  updateContract(@Param('id') id: string, @Body() body: UpdateContractDto) {
    return this.contractsService.updateContract(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/units')
  addContractUnits(
    @Param('id') id: string,
    @Body() body: CreateContractUnitDto[],
  ) {
    return this.contractsService.addContractUnits(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id/units/:unitId')
  removeContractUnit(@Param('id') id: string, @Param('unitId') unitId: string) {
    return this.contractsService.removeContractUnit(id, unitId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/services')
  createContractService(
    @Param('id') id: string,
    @Body() body: CreateContractServiceDto,
  ) {
    return this.contractsService.createContractService(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/billing')
  upsertContractBilling(
    @Param('id') id: string,
    @Body() body: UpsertContractBillingDto,
  ) {
    return this.contractsService.upsertContractBilling(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/contacts')
  createContractContact(
    @Param('id') id: string,
    @Body() body: CreateContractContactDto,
  ) {
    return this.contractsService.createContractContact(id, body);
  }
}
