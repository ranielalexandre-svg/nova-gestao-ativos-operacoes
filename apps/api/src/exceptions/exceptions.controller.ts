import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { BulkUpdateExceptionsDto } from "./dto/bulk-update-exceptions.dto";
import { CreateExceptionDto } from "./dto/create-exception.dto";
import { CreateExceptionCommentDto } from "./dto/create-exception-comment.dto";
import { CreateSlaPolicyDto } from "./dto/create-sla-policy.dto";
import { ListExceptionsQueryDto } from "./dto/list-exceptions-query.dto";
import { UpdateExceptionDto } from "./dto/update-exception.dto";
import { UpdateSlaPolicyDto } from "./dto/update-sla-policy.dto";
import { ExceptionsService } from "./exceptions.service";

@Controller("exceptions")
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listExceptions(@Query() query: ListExceptionsQueryDto) {
    return this.exceptionsService.listExceptions(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get("summary")
  getSummary() {
    return this.exceptionsService.getSummary();
  }

  @UseGuards(JwtAuthGuard)
  @Get("queue/summary")
  getQueueSummary() {
    return this.exceptionsService.getQueueSummary();
  }

  @UseGuards(JwtAuthGuard)
  @Get("sla-policies")
  listSlaPolicies() {
    return this.exceptionsService.listSlaPolicies();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("sla-policies")
  createSlaPolicy(@Body() body: CreateSlaPolicyDto) {
    return this.exceptionsService.createSlaPolicy(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("sla-policies/:id")
  updateSlaPolicy(@Param("id") id: string, @Body() body: UpdateSlaPolicyDto) {
    return this.exceptionsService.updateSlaPolicy(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post("sla-policies/recalculate")
  recalculateSlaPolicies() {
    return this.exceptionsService.recalculateSlaPolicies();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch("bulk")
  bulkUpdate(@Body() body: BulkUpdateExceptionsDto) {
    return this.exceptionsService.bulkUpdateExceptions(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  getException(@Param("id") id: string) {
    return this.exceptionsService.getException(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Post()
  createException(@Body() body: CreateExceptionDto) {
    return this.exceptionsService.createException(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/comments")
  addComment(
    @Param("id") id: string,
    @Body() body: CreateExceptionCommentDto,
    @Req() request: { user?: Record<string, unknown> },
  ) {
    return this.exceptionsService.addComment(id, String(request.user?.sub || ""), body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @Patch(":id")
  updateException(@Param("id") id: string, @Body() body: UpdateExceptionDto) {
    return this.exceptionsService.updateException(id, body);
  }
}
