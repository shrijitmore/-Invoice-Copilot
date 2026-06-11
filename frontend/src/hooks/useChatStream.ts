import { useCallback, useRef, useState } from 'react';
import { API_BASE_URL, downloadFile } from '../lib/api';
import type { ChatStreamEvent } from '../types/api';

/** Live state of an in-flight AI reply. */
export interface StreamState {
  /** True from send until the done/error event. */
  streaming: boolean;
  /** Partial assistant text accumulated so far. */
  partial: string;
  /** Name of the tool currently running, if any. */
  activeTool: string | null;
}

export interface UseChatStreamResult extends StreamState {
  /**
   * Sends a message and streams the reply.
   *
   * @param sessionId - Target chat session.
   * @param content - User message text.
   * @returns The final done event, or null when the stream errored.
   */
  send: (
    sessionId: string,
    content: string,
  ) => Promise<Extract<ChatStreamEvent, { type: 'done' }> | null>;
}

const TOOL_LABELS: Record<string, string> = {
  extract_invoice: 'Reading your invoice',
  summarize_spending: 'Crunching your spending',
  find_overdue: 'Checking overdue invoices',
  calculate_cashflow: 'Projecting cash flow',
  get_top_vendors: 'Ranking your vendors',
  compare_periods: 'Comparing time periods',
  answer_question: 'Looking through your invoices',
  export_data: 'Preparing your export',
};

/**
 * Streams chat replies over SSE (fetch + ReadableStream) with token-level
 * updates, tool status, and automatic CSV download when the agent uses the
 * export_data tool.
 */
export function useChatStream(): UseChatStreamResult {
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const exportTriggered = useRef(false);

  const send = useCallback(
    async (
      sessionId: string,
      content: string,
    ): Promise<Extract<ChatStreamEvent, { type: 'done' }> | null> => {
      setStreaming(true);
      setPartial('');
      setActiveTool(null);
      exportTriggered.current = false;

      let done: Extract<ChatStreamEvent, { type: 'done' }> | null = null;
      let errorMessage: string | null = null;

      try {
        const response = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { value, done: streamEnded } = await reader.read();
          if (streamEnded) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');

            const dataLine = frame
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (!dataLine) {
              continue;
            }
            const event = JSON.parse(dataLine.slice(6)) as ChatStreamEvent;

            if (event.type === 'token') {
              setActiveTool(null);
              setPartial((current) => current + event.content);
            } else if (event.type === 'tool') {
              setActiveTool(TOOL_LABELS[event.tool] ?? 'Working on it');
              if (event.tool === 'export_data' && !exportTriggered.current) {
                exportTriggered.current = true;
                void downloadFile('/invoices/export/csv', 'invoices.csv').catch(() => undefined);
              }
            } else if (event.type === 'done') {
              done = event;
            } else if (event.type === 'error') {
              errorMessage = event.message;
            }
          }
        }
      } catch {
        errorMessage = 'Connection lost while generating the reply. Please try again.';
      } finally {
        setStreaming(false);
        setPartial('');
        setActiveTool(null);
      }

      if (errorMessage && !done) {
        throw new Error(errorMessage);
      }
      return done;
    },
    [],
  );

  return { streaming, partial, activeTool, send };
}
