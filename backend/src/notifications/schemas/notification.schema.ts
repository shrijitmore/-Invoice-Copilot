import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum NotificationType {
  DueSoon = 'due_soon',
  Overdue = 'overdue',
  System = 'system',
}

/**
 * In-app notification shown in the bell dropdown.
 */
@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type!: NotificationType;

  @Prop({ type: String, required: true, maxlength: 200 })
  title!: string;

  @Prop({ type: String, required: true, maxlength: 1000 })
  message!: string;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', default: null })
  invoiceId!: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false, index: true })
  read!: boolean;

  /**
   * Idempotency key (e.g. `due_soon:<invoiceId>`) preventing the scheduler
   * from emitting duplicate alerts for the same invoice and event.
   */
  @Prop({ type: String, default: null })
  dedupeKey!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
NotificationSchema.index({ userId: 1, createdAt: -1 });
