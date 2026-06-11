import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum InvoiceStatus {
  Paid = 'paid',
  Unpaid = 'unpaid',
  Overdue = 'overdue',
}

export enum InvoiceSource {
  Pdf = 'pdf',
  Image = 'image',
  Text = 'text',
  Manual = 'manual',
}

/**
 * A single billed line on an invoice.
 */
@Schema({ _id: false })
export class InvoiceLineItem {
  @Prop({ type: String, required: true, maxlength: 500 })
  description!: string;

  @Prop({ type: Number, required: true, min: 0 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice!: number;

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;
}

const InvoiceLineItemSchema = SchemaFactory.createForClass(InvoiceLineItem);

/**
 * An invoice owned by a user, extracted by AI or entered manually.
 */
@Schema({ timestamps: true })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 200, index: true })
  vendorName!: string;

  @Prop({ type: String, default: '', maxlength: 200 })
  invoiceNumber!: string;

  /** Grand total in the invoice's currency. */
  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: String, default: 'USD', maxlength: 10 })
  currency!: string;

  @Prop({ type: Number, default: 0, min: 0 })
  subtotal!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  taxAmount!: number;

  @Prop({ type: Date, default: null })
  issueDate!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  dueDate!: Date | null;

  @Prop({
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.Unpaid,
    index: true,
  })
  status!: InvoiceStatus;

  @Prop({ type: Date, default: null })
  paymentDate!: Date | null;

  @Prop({ type: [InvoiceLineItemSchema], default: [] })
  lineItems!: InvoiceLineItem[];

  @Prop({ type: String, default: '', maxlength: 20_000 })
  notes!: string;

  /** Original text the invoice was extracted from, kept for traceability. */
  @Prop({ type: String, default: '', maxlength: 50_000 })
  rawText!: string;

  @Prop({ type: String, enum: Object.values(InvoiceSource), default: InvoiceSource.Manual })
  source!: InvoiceSource;

  /** Milliseconds the AI extraction took; powers the avg-processing-time stat. */
  @Prop({ type: Number, default: 0, min: 0 })
  processingTimeMs!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, vendorName: 1 });
InvoiceSchema.index({ userId: 1, dueDate: 1 });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
