import { useState } from 'react';
import { Bot, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMessageTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../types/api';

/** Confidence tiers displayed beneath assistant replies. */
function confidenceLabel(confidence: number): { text: string; className: string } {
  if (confidence >= 0.85) {
    return { text: 'High confidence', className: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (confidence >= 0.5) {
    return { text: 'Medium confidence', className: 'text-amber-600 dark:text-amber-400' };
  }
  return { text: 'Low confidence', className: 'text-red-600 dark:text-red-400' };
}

export interface MessageBubbleProps {
  message: Pick<ChatMessage, 'role' | 'content' | 'confidence'> & { createdAt?: string };
  /** True while this (assistant) message is still streaming in. */
  streaming?: boolean;
}

/**
 * A single chat message: user messages right-aligned in navy, assistant
 * messages left-aligned with avatar, copy button, timestamp and a
 * confidence indicator.
 */
export function MessageBubble({ message, streaming = false }: MessageBubbleProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className={cn('flex gap-3 animate-fade-in', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 text-white">
          <Bot className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className={cn('max-w-[85%] sm:max-w-[75%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'whitespace-pre-wrap rounded-2xl px-4 py-3 text-base leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-navy-700 text-white'
              : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
          )}
        >
          {message.content}
          {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-navy-400 align-text-bottom" aria-hidden />}
        </div>
        <div
          className={cn(
            'mt-1 flex items-center gap-3 px-1 text-xs text-slate-400',
            isUser && 'flex-row-reverse',
          )}
        >
          {message.createdAt && <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>}
          {!isUser && !streaming && message.confidence !== null && message.confidence !== undefined && (
            <span className={confidenceLabel(message.confidence).className}>
              {confidenceLabel(message.confidence).text} ({Math.round(message.confidence * 100)}%)
            </span>
          )}
          {!isUser && !streaming && message.content && (
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copy message"
              className="flex items-center gap-1 rounded p-0.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
