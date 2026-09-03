'use client';

// Family Tree — Chat panel (slide-in from left)
// Realtime group chat for family members.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth';
import {
  fetchMessages,
  sendMessage,
  deleteMessage,
  subscribeToMessages,
  type ChatMessage,
} from '../chat';

interface Props {
  familyId: string;
  onClose: () => void;
}

export function ChatPanel({ familyId, onClose }: Props) {
  const auth = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load + realtime subscription
  useEffect(() => {
    let mounted = true;
    fetchMessages(familyId).then((msgs) => {
      if (mounted) setMessages(msgs);
    });
    const unsub = subscribeToMessages(
      familyId,
      (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      },
      (id) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      },
    );
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [familyId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !auth.user) return;
    setSending(true);
    const content = input;
    setInput('');
    const msg = await sendMessage(familyId, auth.user, content);
    if (msg) {
      // In demo mode, add it locally (no realtime push)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } else {
      setInput(content); // restore on failure
      toast.error('Failed to send message');
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Group messages by day
  const groupedMessages = (() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const dateStr = new Date(msg.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const last = groups[groups.length - 1];
      if (last && last.date === dateStr) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateStr, messages: [msg] });
      }
    }
    return groups;
  })();

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Family chat</h2>
              <p className="text-[10px] text-slate-500">{auth.families.find((f) => f.id === familyId)?.name ?? 'Family'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 p-3" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">No messages yet</p>
              <p className="mt-1 text-xs text-slate-400">Say hello to your family!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="mb-2 text-center">
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {group.date}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.messages.map((msg) => {
                      const isMine = msg.user_id === auth.user?.id;
                      const canDelete = isMine || auth.families.find((f) => f.id === familyId)?.role === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          {!isMine && (
                            <div className="mb-0.5 text-[10px] font-semibold text-slate-500">
                              {msg.user_email}
                            </div>
                          )}
                          <div
                            className={`relative max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                              isMine
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <div className={`mt-0.5 text-[9px] ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(msg.id)}
                                className={`absolute -top-2 ${isMine ? '-left-2' : '-right-2'} hidden h-5 w-5 items-center justify-center rounded-full bg-white text-red-500 shadow-md ring-1 ring-slate-200 hover:bg-red-50 group-hover:flex`}
                                title="Delete message"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            disabled={sending}
            className="flex-1 rounded-full border-slate-300"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !input.trim()}
            className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 p-0 hover:from-emerald-700 hover:to-teal-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
