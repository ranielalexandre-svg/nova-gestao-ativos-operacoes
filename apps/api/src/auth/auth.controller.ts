import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: Record<string, unknown>) {
    return this.authService.login(
      String(body.email || ''),
      String(body.password || ''),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  getSession(@Req() request: { user: Record<string, unknown> }) {
    return this.authService.getSession(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() request: { user: Record<string, unknown> }) {
    return this.authService.getSession(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() request: { user: Record<string, unknown> }) {
    return this.authService.logout(request.user);
  }
}
