import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StarlinksService } from './starlinks.service';

@Controller('starlinks')
@UseGuards(JwtAuthGuard)
export class StarlinksController {
  constructor(private readonly starlinksService: StarlinksService) {}

  @Get()
  listStarlinks() {
    return this.starlinksService.listStarlinks();
  }
}
