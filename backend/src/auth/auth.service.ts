import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserDocument, UserRole } from '../users/schemas/user.schema';
import type { GoogleProfile } from './strategies/google.strategy';
import { TokenService, TokenPair } from './token.service';

/**
 * Orchestrates the OAuth login lifecycle: user provisioning, token
 * issuance, refresh rotation and logout.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Finds or creates the user matching a Google profile and issues a token
   * pair. Emails listed in `ADMIN_EMAILS` are granted the admin role.
   *
   * @param profile - Normalized Google identity.
   * @returns The user plus a fresh token pair.
   */
  async loginWithGoogle(profile: GoogleProfile): Promise<{ user: UserDocument; pair: TokenPair }> {
    const adminEmails = this.configService.get<string[]>('adminEmails') ?? [];
    const role = adminEmails.includes(profile.email.toLowerCase())
      ? UserRole.Admin
      : UserRole.User;

    const user = await this.usersService.upsertFromGoogle(profile, role);
    const pair = await this.tokenService.issueTokenPair(user);
    this.logger.log(`User ${user._id.toString()} logged in via Google`);
    return { user, pair };
  }

  /**
   * Rotates a refresh token into a new pair.
   *
   * @param refreshToken - Raw refresh token from the httpOnly cookie.
   * @returns The user and the replacement token pair.
   */
  async refresh(refreshToken: string): Promise<{ user: UserDocument; pair: TokenPair }> {
    const { pair, user } = await this.tokenService.rotateRefreshToken(refreshToken, (userId) =>
      this.usersService.findById(userId),
    );
    return { user, pair };
  }

  /**
   * Terminates the session tied to the presented refresh token.
   *
   * @param refreshToken - Raw refresh token, if present.
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeByToken(refreshToken);
    }
  }
}
