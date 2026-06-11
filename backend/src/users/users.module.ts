import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-token.schema';
import { ChatMessage, ChatMessageSchema } from '../chat/schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from '../chat/schemas/chat-session.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { AdminController } from './admin.controller';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * User accounts, preferences and admin oversight. Registers the schemas it
 * needs for cross-domain cleanup (account deletion wipes every collection).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
  controllers: [UsersController, AdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
