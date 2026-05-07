import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StarlinksService } from "./starlinks.service";

type AuthenticatedRequest = {
  user?: {
    id?: string;
    sub?: string;
    role?: string;
    email?: string;
  };
};

@Controller("starlinks")
@UseGuards(JwtAuthGuard)
export class StarlinksController {
  constructor(private readonly starlinksService: StarlinksService) {}

  @Get()
  listStarlinks() {
    return this.starlinksService.listStarlinks();
  }

  @Post("import-legacy-data")
  importLegacyStarlinkData(@Req() req: AuthenticatedRequest, @Body() payload: unknown) {
    this.assertAdmin(req);
    return this.starlinksService.importLegacyStarlinkData(payload);
  }

  @Get(":id/legacy-data")
  getLegacyStarlinkData(@Param("id") id: string) {
    return this.starlinksService.getLegacyStarlinkData(id, false);
  }

  @Get(":id/legacy-data/reveal")
  revealLegacyStarlinkData(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    this.assertAdmin(req);
    return this.starlinksService.getLegacyStarlinkData(id, true);
  }

  @Patch(":id/legacy-data/:infoId")
  updateLegacyStarlinkData(
    @Param("id") id: string,
    @Param("infoId") infoId: string,
    @Req() req: AuthenticatedRequest,
    @Body() payload: Record<string, unknown>,
  ) {
    this.assertAdmin(req);
    return this.starlinksService.updateLegacyStarlinkData(id, infoId, payload);
  }

  private assertAdmin(req: AuthenticatedRequest) {
    const role = String(req.user?.role || "").toLowerCase();

    if (role !== "admin") {
      throw new ForbiddenException("Apenas administradores podem acessar dados sensíveis de Starlink.");
    }
  }
}
