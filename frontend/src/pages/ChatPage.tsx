import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, SendHorizontal, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ChatHistorySidebar } from '../components/chat/ChatHistorySidebar';
import { MessageBubble } from '../components/chat/MessageBubble';
import { SuggestedPrompts } from '../components/chat/SuggestedPrompts';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { useChatStream } from '../hooks/useChatStream';
import { api, getErrorMessage } from '../lib/api';
import { MAX_CHAT_MESSAGE_LENGTH } from '../lib/constants';
import { cn } from '../lib/utils';
import type { ChatMessage, ChatSession } from '../types/api';

/** Local optimistic message shape before the server assigns ids. */
interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  confidence: number | null;
  createdAt?: string;
}

/**
 * AI copilot chat: streaming replies, session memory, searchable grouped
 * history, rename/delete, suggested prompts and auto-scroll.
 */
export function ChatPage(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<LocalMessage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
  const debouncedSearch = useDebounce(search);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { streaming, partial, activeTool, send } = useChatStream();

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat', 'sessions', debouncedSearch],
    queryFn: async () =>
      (
        await api.get<ChatSession[]>('/chat/sessions', {
          params: debouncedSearch ? { search: debouncedSearch } : {},
        })
      ).data,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat', 'messages', sessionId],
    queryFn: async () =>
      (await api.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`)).data,
    enabled: Boolean(sessionId),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`/chat/sessions/${id}`, { title }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] }),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/chat/sessions/${id}`),
    onSuccess: (_, deletedId) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
      toast.success('Chat deleted');
      if (deletedId === sessionId) {
        navigate('/chat');
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Auto-scroll to the latest message as content streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingMessages, partial, streaming]);

  // Clear optimistic state when switching sessions.
  useEffect(() => {
    setPendingMessages([]);
  }, [sessionId]);

  const sendMessage = async (content: string): Promise<void> => {
    const trimmed = content.trim();
    if (!trimmed || streaming) {
      return;
    }
    setInput('');

    let targetSessionId = sessionId;
    try {
      if (!targetSessionId) {
        const { data } = await api.post<ChatSession>('/chat/sessions', {});
        targetSessionId = data._id;
        navigate(`/chat/${targetSessionId}`, { replace: true });
      }

      setPendingMessages((current) => [
        ...current,
        { role: 'user', content: trimmed, confidence: null, createdAt: new Date().toISOString() },
      ]);

      const done = await send(targetSessionId, trimmed);
      if (done) {
        setPendingMessages((current) => [
          ...current,
          {
            role: 'assistant',
            content: done.content,
            confidence: done.confidence,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      await queryClient.invalidateQueries({ queryKey: ['chat', 'messages', targetSessionId] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'sessions'] });
      setPendingMessages([]);
    } catch (error) {
      toast.error(getErrorMessage(error, 'The AI could not reply. Please try again.'));
    }
  };

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    void sendMessage(input);
  };

  const visibleMessages: LocalMessage[] = [
    ...(messages ?? []).map((message) => ({
      role: message.role,
      content: message.content,
      confidence: message.confidence,
      createdAt: message.createdAt,
    })),
    ...pendingMessages,
  ];

  const showEmptyState = !sessionId && visibleMessages.length === 0 && !streaming;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* History rail (drawer on mobile) */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={() => setHistoryOpen(false)}
          role="presentation"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white pt-16 transition-transform duration-200 dark:border-slate-700 dark:bg-slate-900 md:static md:z-auto md:translate-x-0 md:pt-0',
          historyOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Chat history"
      >
        <div className="flex justify-end p-2 md:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close chat history"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <ChatHistorySidebar
          sessions={sessions}
          loading={sessionsLoading}
          activeSessionId={sessionId ?? null}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => {
            setHistoryOpen(false);
            navigate(`/chat/${id}`);
          }}
          onNewChat={() => {
            setHistoryOpen(false);
            navigate('/chat');
          }}
          onRename={(id, title) => renameMutation.mutate({ id, title })}
          onDelete={(id) => {
            const session = sessions?.find((item) => item._id === id) ?? null;
            setDeleteTarget(session);
          }}
        />
      </aside>

      {/* Conversation pane */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700 md:hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open chat history"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="truncate font-medium">
            {sessions?.find((session) => session._id === sessionId)?.title ?? 'New chat'}
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          {showEmptyState ? (
            <SuggestedPrompts onSelect={(prompt) => void sendMessage(prompt)} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messagesLoading && sessionId && (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-2/3" />
                  <Skeleton className="ml-auto h-12 w-1/2" />
                  <Skeleton className="h-20 w-3/4" />
                </div>
              )}
              {visibleMessages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
              {streaming && partial && (
                <MessageBubble
                  message={{ role: 'assistant', content: partial, confidence: null }}
                  streaming
                />
              )}
              {streaming && !partial && <TypingIndicator label={activeTool} />}
            </div>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={1}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              placeholder="Ask about your invoices…"
              aria-label="Message"
              className="max-h-40 min-h-[48px] flex-1 resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:border-navy-500 dark:border-slate-600 dark:bg-slate-800"
            />
            <Button type="submit" size="lg" disabled={!input.trim() || streaming} aria-label="Send message">
              <SendHorizontal className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-slate-400">
            Invoice Copilot answers using your uploaded invoice data. Press Enter to send,
            Shift+Enter for a new line.
          </p>
        </form>
      </section>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this chat?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget._id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete chat
            </Button>
          </>
        }
      >
        <p>
          "{deleteTarget?.title}" and all of its messages will be permanently deleted. This cannot
          be undone.
        </p>
      </Modal>
    </div>
  );
}
