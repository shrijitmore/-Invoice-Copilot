import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CHAT_AUTO_TITLE_LENGTH,
  CHAT_HISTORY_WINDOW,
  DEFAULT_CHAT_TITLE,
} from '../common/constants/app.constants';
import { escapeRegex } from '../common/utils/sanitize.util';
import { AgentService, AgentStreamHandlers } from './agent/agent.service';
import { ChatMessage, ChatMessageDocument, ChatRole } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionDocument } from './schemas/chat-session.schema';

/** Completed assistant turn persisted after streaming. */
export interface CompletedTurn {
  messageId: string;
  content: string;
  confidence: number | null;
}

/**
 * Chat domain logic: session lifecycle, message persistence, conversation
 * memory and agent orchestration.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatSession.name)
    private readonly sessionModel: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
    private readonly agentService: AgentService,
  ) {}

  /**
   * Creates a new chat session.
   *
   * @param userId - Owning user id.
   * @param title - Optional initial title.
   */
  async createSession(userId: string, title?: string): Promise<ChatSessionDocument> {
    return this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      title: title || DEFAULT_CHAT_TITLE,
      lastMessageAt: new Date(),
    });
  }

  /**
   * Lists the user's sessions, newest activity first, optionally filtered
   * by a title search.
   */
  async listSessions(userId: string, search?: string): Promise<ChatSessionDocument[]> {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (search) {
      filter.title = new RegExp(escapeRegex(search), 'i');
    }
    return this.sessionModel.find(filter).sort({ lastMessageAt: -1 }).limit(200).exec();
  }

  /**
   * Renames a session.
   *
   * @throws NotFoundException when missing or not owned by the user.
   */
  async renameSession(
    userId: string,
    sessionId: string,
    title: string,
  ): Promise<ChatSessionDocument> {
    const session = await this.sessionModel
      .findOneAndUpdate(
        { _id: this.toObjectId(sessionId), userId: new Types.ObjectId(userId) },
        { $set: { title } },
        { new: true },
      )
      .exec();
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  /**
   * Deletes a session and all of its messages.
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.getOwnedSession(userId, sessionId);
    await Promise.all([
      this.messageModel.deleteMany({ sessionId: session._id }).exec(),
      session.deleteOne(),
    ]);
  }

  /**
   * Returns every message in a session, oldest first.
   */
  async getMessages(userId: string, sessionId: string): Promise<ChatMessageDocument[]> {
    const session = await this.getOwnedSession(userId, sessionId);
    return this.messageModel.find({ sessionId: session._id }).sort({ createdAt: 1 }).exec();
  }

  /**
   * Handles one full user turn: persists the user message, replays the
   * session memory through the agent, streams the answer via the supplied
   * handlers, then persists the assistant message.
   *
   * @param userId - Owning user id.
   * @param sessionId - Target session id.
   * @param content - Sanitized user message.
   * @param handlers - SSE streaming callbacks.
   * @returns The persisted assistant turn.
   */
  async runTurn(
    userId: string,
    sessionId: string,
    content: string,
    handlers: AgentStreamHandlers,
  ): Promise<CompletedTurn> {
    const session = await this.getOwnedSession(userId, sessionId);
    const owner = new Types.ObjectId(userId);

    const priorCount = await this.messageModel.countDocuments({ sessionId: session._id }).exec();

    await this.messageModel.create({
      sessionId: session._id,
      userId: owner,
      role: ChatRole.User,
      content,
    });

    // Auto-title brand-new sessions from the first user message.
    if (priorCount === 0 && session.title === DEFAULT_CHAT_TITLE) {
      session.title =
        content.length > CHAT_AUTO_TITLE_LENGTH
          ? `${content.slice(0, CHAT_AUTO_TITLE_LENGTH - 3)}...`
          : content;
    }

    const history = await this.messageModel
      .find({ sessionId: session._id })
      .sort({ createdAt: -1 })
      .limit(CHAT_HISTORY_WINDOW)
      .exec()
      .then((messages) => messages.reverse().slice(0, -1));

    const result = await this.agentService.run(userId, history, content, handlers);

    const assistantMessage = await this.messageModel.create({
      sessionId: session._id,
      userId: owner,
      role: ChatRole.Assistant,
      content: result.content,
      confidence: result.confidence,
    });

    session.lastMessageAt = new Date();
    await session.save();

    return {
      messageId: assistantMessage._id.toString(),
      content: result.content,
      confidence: result.confidence,
    };
  }

  private async getOwnedSession(userId: string, sessionId: string): Promise<ChatSessionDocument> {
    const session = await this.sessionModel
      .findOne({ _id: this.toObjectId(sessionId), userId: new Types.ObjectId(userId) })
      .exec();
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Chat session not found');
    }
    return new Types.ObjectId(id);
  }
}
