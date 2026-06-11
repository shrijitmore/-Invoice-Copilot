import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { AgentToolsFactory } from './agent/agent-tools.factory';
import { AgentService } from './agent/agent.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';

/**
 * Conversational AI: sessions, memory and the streaming LangChain agent.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    AiModule,
    AnalyticsModule,
    InvoicesModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, AgentService, AgentToolsFactory],
})
export class ChatModule {}
