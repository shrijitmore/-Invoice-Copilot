import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

/** Normalized identity returned by Google after a successful OAuth flow. */
export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}

/**
 * Passport strategy handling the Google OAuth 2.0 authorization-code flow.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('google.clientId'),
      clientSecret: configService.getOrThrow<string>('google.clientSecret'),
      callbackURL: configService.getOrThrow<string>('google.callbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  /**
   * Maps the raw Google profile to {@link GoogleProfile}; attached to the
   * request as `req.user` by Passport.
   *
   * @param _accessToken - Google access token (unused; we only need identity).
   * @param _refreshToken - Google refresh token (unused).
   * @param profile - Raw profile from Google.
   * @returns Normalized profile data.
   */
  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException('Google account has no verified email');
    }
    return {
      googleId: profile.id,
      email,
      name: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value ?? '',
    };
  }
}
