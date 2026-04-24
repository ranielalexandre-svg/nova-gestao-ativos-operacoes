import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
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
