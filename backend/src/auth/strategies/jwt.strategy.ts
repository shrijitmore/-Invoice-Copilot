import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '../../common/constants/app.constants';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../common/interfaces/authenticated-user.interface';

/**
 * Reads the access token from the httpOnly cookie (never from headers or
 * query strings) so tokens stay out of JavaScript-accessible storage.
 */
function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

/**
 * Passport strategy validating short-lived JWT access tokens.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /**
   * Maps the verified token payload to the request user object.
   *
   * @param payload - Decoded access token payload.
   * @returns The {@link AuthenticatedUser} attached to `req.user`.
   */
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
