import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { RenameSessionDto } from './dto/rename-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import type { ChatMessageDocument } from './schemas/chat-message.schema';
import type { ChatSessionDocument } from './schemas/chat-session.schema';

/** Server-sent event payloads emitted while streaming a reply. */
type ChatStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool'; tool: string }
  | { type: 'done'; messageId: string; content: string; confidence: number | null }
  | { type: 'error'; message: string };

/**
 * Chat API: session CRUD plus the SSE endpoint that streams AI replies
 * token by token.
 */
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  /** Creates a chat session. */
  @Post('sessions')
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSessionDocument> {
    return this.chatService.createSession(user.userId, dto.title);
  }

  /** Lists sessions, newest first, with optional title search. */
  @Get('sessions')
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ): Promise<ChatSessionDocument[]> {
    return this.chatService.listSessions(user.userId, search?.slice(0, 200));
  }

  /** Renames a session. */
  @Patch('sessions/:id')
  renameSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenameSessionDto,
  ): Promise<ChatSessionDocument> {
    return this.chatService.renameSession(user.userId, id, dto.title);
  }

  /** Deletes a session and its messages. */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.chatService.deleteSession(user.userId, id);
    return { success: true };
  }

  /** Full message history of a session, oldest first. */
  @Get('sessions/:id/messages')
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ChatMessageDocument[]> {
    return this.chatService.getMessages(user.userId, id);
  }

  /**
   * Sends a user message and streams the AI reply as server-sent events:
   * `token` events for each chunk, `tool` events while tools run, then a
   * single `done` (or `error`) event.
   */
  @Post('sessions/:id/messages')
  async sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: ChatStreamEvent): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const turn = await this.chatService.runTurn(user.userId, id, dto.content, {
        onToken: (content) => send({ type: 'token', content }),
        onTool: (tool) => send({ type: 'tool', tool }),
      });
      send({
        type: 'done',
        messageId: turn.messageId,
        content: turn.content,
        confidence: turn.confidence,
      });
    } catch (error) {
      this.logger.error(`Chat turn failed: ${(error as Error).message}`);
      send({
        type: 'error',
        message:
          error instanceof Error && error.name === 'NotFoundException'
            ? 'Chat session not found'
            : 'Something went wrong while generating the reply. Please try again.',
      });
    } finally {
      res.end();
    }
  }
}
