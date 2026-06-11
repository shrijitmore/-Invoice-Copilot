import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * A conversation thread between a user and the AI copilot.
 */
@Schema({ timestamps: true })
export class ChatSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 200, default: 'New chat' })
  title!: string;

  /** Denormalized timestamp of the latest message, used for sidebar ordering. */
  @Prop({ type: Date, default: () => new Date(), index: true })
  lastMessageAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ChatSessionDocument = HydratedDocument<ChatSession>;
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);

ChatSessionSchema.index({ userId: 1, lastMessageAt: -1 });
