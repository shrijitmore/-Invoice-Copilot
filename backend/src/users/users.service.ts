import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from '../auth/schemas/refresh-token.schema';
import type { GoogleProfile } from '../auth/strategies/google.strategy';
import { ChatMessage, ChatMessageDocument } from '../chat/schemas/chat-message.schema';
import { ChatSession, ChatSessionDocument } from '../chat/schemas/chat-session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import {
  Notification,
  NotificationDocument,
} from '../notifications/schemas/notification.schema';
import { User, UserDocument, UserRole, UserSettings } from './schemas/user.schema';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

/** Public projection of a user document returned to clients. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  settings: UserSettings;
  createdAt: Date;
}

/** Aggregate account statistics for the profile page. */
export interface AccountStats {
  totalInvoices: number;
  totalSpend: number;
  chatSessions: number;
  memberSince: Date;
}

/**
 * User lifecycle: provisioning from OAuth, profile management, preferences,
 * account statistics, and full account/data deletion.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  /**
   * Creates or updates a user from a Google profile (idempotent upsert).
   *
   * @param profile - Normalized Google identity.
   * @param role - Role to assign (admin when allow-listed).
   * @returns The persisted user document.
   */
  async upsertFromGoogle(profile: GoogleProfile, role: UserRole): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ googleId: profile.googleId }).exec();
    if (existing) {
      existing.role = role === UserRole.Admin ? UserRole.Admin : existing.role;
      if (!existing.avatarUrl && profile.avatarUrl) {
        existing.avatarUrl = profile.avatarUrl;
      }
      return existing.save();
    }
    return this.userModel.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      role,
    });
  }

  /**
   * Loads a user document by id.
   *
   * @param userId - User id string.
   * @returns The document or null when missing.
   */
  async findById(userId: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }
    return this.userModel.findById(userId).exec();
  }

  /**
   * Returns the client-safe profile projection for a user.
   *
   * @param userId - User id string.
   * @throws NotFoundException when the user does not exist.
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  /**
   * Updates the user's display name.
   *
   * @param userId - User id string.
   * @param dto - Validated profile changes.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { name: dto.name } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  /**
   * Stores an uploaded avatar as a data URI on the user document.
   *
   * @param userId - User id string.
   * @param mimeType - Validated image MIME type.
   * @param buffer - Raw image bytes (size pre-validated by the controller).
   */
  async updateAvatar(userId: string, mimeType: string, buffer: Buffer): Promise<UserProfile> {
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { avatarUrl: dataUri } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  /**
   * Merges preference changes into the user's settings.
   *
   * @param userId - User id string.
   * @param dto - Validated partial settings.
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserProfile> {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        updates[`settings.${key}`] = value;
      }
    }
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: updates }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toProfile(user);
  }

  /**
   * Computes account statistics for the profile page.
   *
   * @param userId - User id string.
   */
  async getStats(userId: string): Promise<AccountStats> {
    const owner = new Types.ObjectId(userId);
    const [user, totalInvoices, chatSessions, spendAgg] = await Promise.all([
      this.findById(userId),
      this.invoiceModel.countDocuments({ userId: owner }).exec(),
      this.chatSessionModel.countDocuments({ userId: owner }).exec(),
      this.invoiceModel
        .aggregate<{ _id: null; total: number }>([
          { $match: { userId: owner } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .exec(),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      totalInvoices,
      totalSpend: spendAgg[0]?.total ?? 0,
      chatSessions,
      memberSince: user.createdAt,
    };
  }

  /**
   * Deletes all of a user's business data (invoices, chats, notifications)
   * while keeping the account itself.
   *
   * @param userId - User id string.
   */
  async deleteAllData(userId: string): Promise<void> {
    const owner = new Types.ObjectId(userId);
    await Promise.all([
      this.invoiceModel.deleteMany({ userId: owner }).exec(),
      this.chatSessionModel.deleteMany({ userId: owner }).exec(),
      this.chatMessageModel.deleteMany({ userId: owner }).exec(),
      this.notificationModel.deleteMany({ userId: owner }).exec(),
    ]);
    this.logger.log(`Wiped all data for user ${userId}`);
  }

  /**
   * Permanently deletes the account: every piece of user data, all
   * sessions, then the user record itself.
   *
   * @param userId - User id string.
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.deleteAllData(userId);
    await this.refreshTokenModel.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
    await this.userModel.findByIdAndDelete(userId).exec();
    this.logger.log(`Deleted account ${userId}`);
  }

  /**
   * Admin: lists all users with a lightweight projection.
   */
  async listUsers(): Promise<UserProfile[]> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).limit(500).exec();
    return users.map((user) => this.toProfile(user));
  }

  /**
   * Admin: platform-wide counts.
   */
  async platformStats(): Promise<{ users: number; invoices: number; chatSessions: number }> {
    const [users, invoices, chatSessions] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.invoiceModel.countDocuments().exec(),
      this.chatSessionModel.countDocuments().exec(),
    ]);
    return { users, invoices, chatSessions };
  }

  private toProfile(user: UserDocument): UserProfile {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      settings: user.settings,
      createdAt: user.createdAt,
    };
  }
}
