import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

/** Tunables for a model instance. */
export interface LlmOptions {
  temperature?: number;
  streaming?: boolean;
}

/**
 * Single factory for LangChain chat models so model name, API key and
 * defaults live in exactly one place.
 */
@Injectable()
export class LlmProvider {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Creates a configured {@link ChatOpenAI} instance.
   *
   * @param options - Optional temperature/streaming overrides.
   * @returns A ready-to-use chat model.
   */
  createChatModel(options: LlmOptions = {}): ChatOpenAI {
    return new ChatOpenAI({
      model: this.configService.getOrThrow<string>('openai.model'),
      apiKey: this.configService.getOrThrow<string>('openai.apiKey'),
      temperature: options.temperature ?? 0,
      streaming: options.streaming ?? false,
      maxRetries: 2,
      timeout: 60_000,
    });
  }
}
