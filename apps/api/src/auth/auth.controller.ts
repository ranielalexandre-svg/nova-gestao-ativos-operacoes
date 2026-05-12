import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(
      body.email,
      body.password,
      body.remember === true,
    );
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
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
