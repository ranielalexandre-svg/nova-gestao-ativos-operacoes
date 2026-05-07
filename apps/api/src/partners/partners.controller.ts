import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreatePartnerDto } from "./dto/create-partner.dto";
import { ListPartnersQueryDto } from "./dto/list-partners-query.dto";
import { UpdatePartnerDto } from "./dto/update-partner.dto";
import { PartnersService } from "./partners.service";

@Controller("partners")
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listPartners(@Query() query: ListPartnersQueryDto) {
    return this.partnersService.listPartners(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getPartnerById(@Param("id") id: string) {
    return this.partnersService.getPartnerById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createPartner(@Body() body: CreatePartnerDto) {
    return this.partnersService.createPartner(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updatePartner(@Param("id") id: string, @Body() body: UpdatePartnerDto) {
    return this.partnersService.updatePartner(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("import-legacy-contacts")
  importLegacyContacts(@Body() body: unknown) {
    return this.partnersService.importLegacyContacts(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post(":id/contacts")
  createPartnerContact(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.partnersService.createPartnerContact(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id/contacts/:contactId")
  updatePartnerContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.partnersService.updatePartnerContact(id, contactId, body);
  }
}
