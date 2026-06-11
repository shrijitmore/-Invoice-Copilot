import { Injectable, Logger } from '@nestjs/common';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';
import { LlmProvider } from '../../ai/llm.provider';
import { ChatRole, ChatMessageDocument } from '../schemas/chat-message.schema';
import { AgentToolsFactory, ToolEventHandler } from './agent-tools.factory';
import { buildAgentSystemPrompt } from './agent.prompt';

/** Streaming callbacks surfaced to the SSE layer. */
export interface AgentStreamHandlers {
  /** Called for each displayable token of the final answer. */
  onToken: (token: string) => void;
  /** Called when the agent invokes a tool (drives the typing indicator). */
  onTool: ToolEventHandler;
}

/** Final result of an agent run. */
export interface AgentResult {
  content: string;
  confidence: number | null;
}

const MAX_AGENT_ITERATIONS = 6;
const CONFIDENCE_MARKER = /^\s*\[\[confidence:(\d(?:\.\d{1,2})?)\]\]\s*/;
/** Longest possible marker: "[[confidence:0.99]]" plus whitespace. */
const MARKER_BUFFER_LIMIT = 30;

/**
 * Tool-calling agent loop with true token streaming. Each turn the model
 * either calls tools (executed, results appended, loop continues) or
 * produces the final answer, which is streamed token by token after the
 * leading confidence marker has been parsed and stripped.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly toolsFactory: AgentToolsFactory,
  ) {}

  /**
   * Runs the agent for one user turn.
   *
   * @param userId - Authenticated user whose data the tools may access.
   * @param history - Prior session messages (oldest first).
   * @param userMessage - The new user message.
   * @param handlers - Streaming callbacks.
   * @returns The full answer text (marker stripped) and parsed confidence.
   */
  async run(
    userId: string,
    history: ChatMessageDocument[],
    userMessage: string,
    handlers: AgentStreamHandlers,
  ): Promise<AgentResult> {
    const tools = this.toolsFactory.createTools(userId, handlers.onTool);
    const model = this.llmProvider.createChatModel({ temperature: 0.2, streaming: true });
    const modelWithTools = model.bindTools(tools);
    const toolsByName = new Map(tools.map((t) => [t.name, t]));

    const messages: BaseMessage[] = [
      new SystemMessage(buildAgentSystemPrompt(new Date().toISOString().slice(0, 10))),
      ...history.map((msg) =>
        msg.role === ChatRole.User ? new HumanMessage(msg.content) : new AIMessage(msg.content),
      ),
      new HumanMessage(userMessage),
    ];

    for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
      const emitter = new MarkerStrippingEmitter(handlers.onToken);
      const stream = await modelWithTools.stream(messages);

      let gathered: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        gathered = gathered === undefined ? chunk : concat(gathered, chunk);
        if (typeof chunk.content === 'string' && chunk.content.length > 0) {
          emitter.push(chunk.content);
        }
      }

      if (!gathered) {
        break;
      }

      const toolCalls = gathered.tool_calls ?? [];
      if (toolCalls.length === 0) {
        emitter.flush();
        const raw = typeof gathered.content === 'string' ? gathered.content : '';
        return this.parseFinal(raw);
      }

      messages.push(gathered);
      for (const call of toolCalls) {
        const matched = toolsByName.get(call.name);
        let output: string;
        try {
          output = matched
            ? String(await matched.invoke(call.args))
            : `Unknown tool: ${call.name}`;
        } catch (error) {
          this.logger.warn(`Tool ${call.name} failed: ${(error as Error).message}`);
          output = `The ${call.name} tool failed. Apologize briefly and suggest trying again.`;
        }
        messages.push(new ToolMessage({ content: output, tool_call_id: call.id ?? call.name }));
      }
    }

    const fallback =
      "I wasn't able to finish working through that request. Could you rephrase it or break it into smaller questions?";
    handlers.onToken(fallback);
    return { content: fallback, confidence: 0.2 };
  }

  private parseFinal(raw: string): AgentResult {
    const match = CONFIDENCE_MARKER.exec(raw);
    if (match) {
      return {
        content: raw.replace(CONFIDENCE_MARKER, ''),
        confidence: Math.min(1, Math.max(0, parseFloat(match[1]))),
      };
    }
    return { content: raw, confidence: null };
  }
}

/**
 * Buffers the head of the stream until the leading `[[confidence:..]]`
 * marker has been consumed (or proven absent), then forwards tokens
 * untouched so the visible answer never flashes the marker.
 */
class MarkerStrippingEmitter {
  private buffer = '';
  private resolved = false;

  constructor(private readonly emit: (token: string) => void) {}

  /** Feeds a streamed chunk through the marker filter. */
  push(chunk: string): void {
    if (this.resolved) {
      this.emit(chunk);
      return;
    }
    this.buffer += chunk;

    const match = CONFIDENCE_MARKER.exec(this.buffer);
    if (match) {
      this.resolved = true;
      const rest = this.buffer.slice(match[0].length);
      if (rest.length > 0) {
        this.emit(rest);
      }
      this.buffer = '';
      return;
    }

    if (!this.couldStillMatch()) {
      this.resolved = true;
      this.emit(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Whether the buffered head could still grow into a complete
   * `[[confidence:X.XX]]` marker.
   */
  private couldStillMatch(): boolean {
    if (this.buffer.length >= MARKER_BUFFER_LIMIT) {
      return false;
    }
    const trimmed = this.buffer.trimStart();
    const prefix = '[[confidence:';
    if (trimmed.length <= prefix.length) {
      return prefix.startsWith(trimmed);
    }
    return trimmed.startsWith(prefix) && /^[\d.]{0,4}\]{0,2}$/.test(trimmed.slice(prefix.length));
  }

  /** Flushes any residue at end of stream. */
  flush(): void {
    if (!this.resolved && this.buffer.length > 0) {
      const match = CONFIDENCE_MARKER.exec(this.buffer);
      this.emit(match ? this.buffer.slice(match[0].length) : this.buffer);
    }
    this.resolved = true;
    this.buffer = '';
  }
}
