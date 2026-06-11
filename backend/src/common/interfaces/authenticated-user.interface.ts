import type { UserRole } from '../../users/schemas/user.schema';

/**
 * Shape of the user object attached to requests after JWT validation.
 */
export interface AuthenticatedUser {
  /** MongoDB ObjectId of the user, as a string. */
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Payload encoded inside access tokens.
 */
export interface AccessTokenPayload {
  /** Subject: the user's id. */
  sub: string;
  email: string;
  role: UserRole;
}

/**
 * Payload encoded inside refresh tokens.
 */
export interface RefreshTokenPayload {
  sub: string;
  /** Unique id of this refresh token, used for rotation tracking. */
  jti: string;
}
