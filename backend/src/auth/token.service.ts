import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../common/interfaces/authenticated-user.interface';
import type { UserDocument } from '../users/schemas/user.schema';
import { RefreshToken, RefreshTokenDocument } from './schemas/refresh-token.schema';

/** Result of issuing a fresh token pair. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues, verifies and rotates JWT access/refresh tokens.
 *
 * Refresh tokens are single-use: each refresh invalidates the presented
 * token and issues a replacement within the same "family". Presenting an
 * already-used token is treated as theft and revokes the entire family.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  /**
   * Issues a new access + refresh token pair for a user, starting a new
   * refresh-token family (used at login).
   *
   * @param user - The authenticated user document.
   * @returns The signed token pair.
   */
  async issueTokenPair(user: UserDocument): Promise<TokenPair> {
    const family = randomUUID();
    return this.buildPair(user, family);
  }

  /**
   * Rotates a refresh token: verifies it, invalidates it, and issues a new
   * pair in the same family. Reuse of a consumed token revokes the family.
   *
   * @param refreshToken - The raw refresh token presented by the client.
   * @param loadUser - Callback resolving the owning user by id.
   * @returns A fresh token pair.
   * @throws UnauthorizedException when the token is invalid, expired or reused.
   */
  async rotateRefreshToken(
    refreshToken: string,
    loadUser: (userId: string) => Promise<UserDocument | null>,
  ): Promise<{ pair: TokenPair; user: UserDocument }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hash(payload.jti);
    const record = await this.refreshTokenModel.findOne({ tokenHash }).exec();

    if (!record) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    if (record.revoked || record.expiresAt.getTime() < Date.now()) {
      // Possible token theft: kill every descendant of this login session.
      await this.refreshTokenModel
        .updateMany({ family: record.family }, { $set: { revoked: true } })
        .exec();
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }

    const user = await loadUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    record.revoked = true;
    await record.save();

    const pair = await this.buildPair(user, record.family);
    return { pair, user };
  }

  /**
   * Revokes every refresh token belonging to a user (logout-all / account
   * deletion).
   *
   * @param userId - The user whose sessions should be terminated.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel
      .updateMany({ userId: new Types.ObjectId(userId) }, { $set: { revoked: true } })
      .exec();
  }

  /**
   * Revokes the single session associated with a presented refresh token.
   * Invalid tokens are ignored so logout always succeeds.
   *
   * @param refreshToken - The raw refresh token from the logout request.
   */
  async revokeByToken(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        ignoreExpiration: true,
      });
      await this.refreshTokenModel
        .updateOne({ tokenHash: this.hash(payload.jti) }, { $set: { revoked: true } })
        .exec();
    } catch {
      // Token unparseable — nothing to revoke.
    }
  }

  private async buildPair(user: UserDocument, family: string): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: user._id.toString(), jti };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.accessExpiresIn'),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    await this.refreshTokenModel.create({
      userId: user._id,
      tokenHash: this.hash(jti),
      family,
      expiresAt: this.refreshExpiryDate(),
      revoked: false,
    });

    return { accessToken, refreshToken };
  }

  private refreshExpiryDate(): Date {
    const raw = this.configService.getOrThrow<string>('jwt.refreshExpiresIn');
    const match = /^(\d+)([smhd])$/.exec(raw);
    const unitMs: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ms = match ? parseInt(match[1], 10) * unitMs[match[2]] : 7 * 86_400_000;
    return new Date(Date.now() + ms);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
