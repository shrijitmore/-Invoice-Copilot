import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../common/constants/app.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { GoogleProfile } from './strategies/google.strategy';
import type { TokenPair } from './token.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 15 * 60 * 1000 } };

/**
 * Authentication endpoints: Google OAuth flow, token refresh, logout and
 * current-session introspection. Auth routes use a stricter rate limit
 * (10 requests / 15 min) than the rest of the API.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Entry point of the Google OAuth flow; redirects to Google's consent
   * screen. The guard performs the redirect, so the body never executes.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @UseGuards(AuthGuard('google'))
  @Get('google')
  googleAuth(): void {
    // Redirect handled entirely by the Google guard.
  }

  /**
   * Google redirects here after consent. Provisions the user, sets the
   * token cookies and bounces back to the frontend.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleProfile;
    const { pair } = await this.authService.loginWithGoogle(profile);
    this.setAuthCookies(res, pair);
    res.redirect(`${this.configService.getOrThrow<string>('frontendUrl')}/auth/callback`);
  }

  /**
   * Exchanges the refresh-token cookie for a new token pair (rotation).
   * The presented refresh token is invalidated; reuse revokes the session
   * family.
   */
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    const refreshToken = cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const { pair } = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, pair);
    return { success: true };
  }

  /**
   * Logs out: revokes the refresh token server-side and clears both cookies.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    const cookies = req.cookies as Record<string, string> | undefined;
    await this.authService.logout(cookies?.[REFRESH_TOKEN_COOKIE]);
    this.clearAuthCookies(res);
    return { success: true };
  }

  /**
   * Returns the authenticated user's full profile; used by the frontend to
   * hydrate the session after page load or OAuth redirect.
   */
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.usersService.getProfile(user.userId);
  }

  private cookieOptions(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.getOrThrow<boolean>('cookies.secure'),
      sameSite: this.configService.getOrThrow<'lax' | 'strict' | 'none'>('cookies.sameSite'),
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  private setAuthCookies(res: Response, pair: TokenPair): void {
    res.cookie(ACCESS_TOKEN_COOKIE, pair.accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_TOKEN_COOKIE, pair.refreshToken, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions(0));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(0));
  }
}
