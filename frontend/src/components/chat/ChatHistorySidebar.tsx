import { useMemo, useState } from 'react';
import { Check, MessageSquarePlus, Pencil, Search, Trash2, X } from 'lucide-react';
import { groupByRecency, type HistoryGroup } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { ChatSession } from '../../types/api';
import { Skeleton } from '../ui/Skeleton';

const GROUP_ORDER: HistoryGroup[] = ['Today', 'Yesterday', 'Last 7 Days', 'Older'];

export interface ChatHistorySidebarProps {
  sessions: ChatSession[] | undefined;
  loading: boolean;
  activeSessionId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
}

/**
 * Searchable chat history grouped by recency (Today / Yesterday / Last 7
 * Days / Older) with inline rename and delete.
 */
export function ChatHistorySidebar({
  sessions,
  loading,
  activeSessionId,
  search,
  onSearchChange,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: ChatHistorySidebarProps): JSX.Element {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const grouped = useMemo(() => {
    const buckets = new Map<HistoryGroup, ChatSession[]>();
    for (const session of sessions ?? []) {
      const group = groupByRecency(session.lastMessageAt);
      const list = buckets.get(group) ?? [];
      list.push(session);
      buckets.set(group, list);
    }
    return buckets;
  }, [sessions]);

  const commitRename = (sessionId: string): void => {
    const title = editTitle.trim();
    if (title) {
      onRename(sessionId, title);
    }
    setEditingId(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 p-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-navy-700 font-medium text-white transition-colors hover:bg-navy-800"
        >
          <MessageSquarePlus className="h-5 w-5" aria-hidden />
          New chat
        </button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-base dark:border-slate-600 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
        {loading && (
          <div className="space-y-2 px-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!loading && (sessions?.length ?? 0) === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            {search ? 'No chats match your search.' : 'Your conversations will appear here.'}
          </p>
        )}

        {GROUP_ORDER.map((group) => {
          const items = grouped.get(group);
          if (!items || items.length === 0) {
            return null;
          }
          return (
            <div key={group} className="mb-3">
              <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group}
              </h3>
              <ul className="space-y-0.5">
                {items.map((session) => (
                  <li key={session._id} className="group relative">
                    {editingId === session._id ? (
                      <div className="flex items-center gap-1 px-2">
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename(session._id);
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          aria-label="Chat title"
                          autoFocus
                          maxLength={200}
                          className="h-9 w-full rounded-lg border border-navy-400 bg-white px-2 text-sm dark:bg-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(session._id)}
                          aria-label="Save title"
                          className="rounded p-1.5 text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel rename"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(session._id)}
                        className={cn(
                          'flex w-full items-center rounded-lg px-3 py-2 pr-16 text-left text-sm transition-colors',
                          session._id === activeSessionId
                            ? 'bg-navy-100 font-medium text-navy-900 dark:bg-navy-800 dark:text-white'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                        )}
                      >
                        <span className="truncate">{session.title}</span>
                      </button>
                    )}
                    {editingId !== session._id && (
                      <span className="absolute right-2 top-1/2 hidden -translate-y-1/2 gap-0.5 group-hover:flex">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(session._id);
                            setEditTitle(session.title);
                          }}
                          aria-label={`Rename chat ${session.title}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(session._id)}
                          aria-label={`Delete chat ${session.title}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
