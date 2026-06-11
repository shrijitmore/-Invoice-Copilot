import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Server-side record of an issued refresh token. Only a SHA-256 hash of the
 * token id (`jti`) is persisted — never the token itself. Rotation marks the
 * old record revoked; reuse of a revoked token revokes the whole family.
 */
@Schema({ timestamps: true })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** SHA-256 hash of the refresh token's jti claim. */
  @Prop({ type: String, required: true, unique: true, index: true })
  tokenHash!: string;

  /** Groups tokens descended from one login so reuse can revoke the family. */
  @Prop({ type: String, required: true, index: true })
  family!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Boolean, default: false })
  revoked!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL index: MongoDB purges expired token records automatically.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
