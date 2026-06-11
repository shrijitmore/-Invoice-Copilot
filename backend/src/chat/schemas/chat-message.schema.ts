import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum ChatRole {
  User = 'user',
  Assistant = 'assistant',
}

/**
 * A single message within a chat session. Assistant messages carry an
 * optional confidence score (0–1) produced by the agent.
 */
@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ChatRole), required: true })
  role!: ChatRole;

  @Prop({ type: String, required: true, maxlength: 50_000 })
  content!: string;

  @Prop({ type: Number, default: null, min: 0, max: 1 })
  confidence!: number | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
