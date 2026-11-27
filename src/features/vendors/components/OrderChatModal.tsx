import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, MessageSquare, Send, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  fetchOrderChatMessages,
  sendOrderChatMessage,
  subscribeToOrderChat,
} from '@/features/vendors/services/vendorService';
import type { OrderChatMessageRow } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utilities/cn';

export interface OrderChatContext {
  orderId: string;
  orderTitle: string;
  counterpartyLabel: string;
  agreedPriceLabel: string;
}

interface OrderChatModalProps {
  chat: OrderChatContext | null;
  onClose: () => void;
}

export function OrderChatModal({ chat, onClose }: OrderChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<OrderChatMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!chat) return;
    const res = await fetchOrderChatMessages(chat.orderId);
    if (res.error) {
      setError(res.error);
    } else {
      setMessages(res.messages);
    }
    setLoading(false);
  }, [chat]);

  useEffect(() => {
    if (!chat) return;
    setLoading(true);
    setError(null);
    void loadMessages();
    const unsubscribe = subscribeToOrderChat(chat.orderId, () => {
      void loadMessages();
    });
    return unsubscribe;
  }, [chat, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!chat) return null;

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    const res = await sendOrderChatMessage(chat.orderId, draft);
    setSending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDraft('');
    await loadMessages();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="In-Site Order Chat"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-[82vh] max-h-[640px] w-full max-w-lg flex-col border border-brand-gold/55 bg-brand-charcoal shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b hairline-border bg-brand-black px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-heading text-[0.65rem] tracking-[0.2em] text-brand-gold uppercase">
              <MessageSquare className="h-3.5 w-3.5" />
              Live Order Chat &bull; {chat.counterpartyLabel}
            </p>
            <h3 className="mt-1 truncate font-heading text-base text-brand-white">
              {chat.orderTitle} ({chat.agreedPriceLabel})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-1 text-brand-muted hover:text-brand-white"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Safety Strip */}
        <div className="flex items-center gap-2 border-b hairline-border bg-brand-black/60 px-4 py-2 text-[11px] text-brand-muted">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-brand-gold" />
          <span>
            Never share passwords, PINs, or 2FA codes. Chat is visible to VATAR Admins if disputed.
          </span>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-brand-muted">
              <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-xs text-brand-muted">
              No messages yet. Say hello to coordinate payment and delivery right inside VATAR!
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              const isAdminMsg = m.sender_role === 'admin';
              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex flex-col max-w-[85%]',
                    isMine ? 'ml-auto items-end' : 'mr-auto items-start',
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] text-brand-muted">
                    <span className="font-semibold text-brand-cream">
                      @{m.sender_username}
                    </span>
                    <span className="uppercase text-brand-gold">({m.sender_role})</span>
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'border px-3.5 py-2.5 text-xs leading-relaxed break-words',
                      isAdminMsg
                        ? 'border-amber-400/60 bg-amber-950/40 text-amber-100'
                        : isMine
                          ? 'border-brand-gold/60 bg-brand-gold/15 text-brand-white'
                          : 'hairline-border bg-brand-black text-brand-cream',
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="border-t border-rose-500/40 bg-rose-950/40 px-4 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => void handleSend(e)}
          className="flex items-center gap-2 border-t hairline-border bg-brand-black p-3"
        >
          <input
            type="text"
            maxLength={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type message to vendor / buyer..."
            className="flex-1 border hairline-border bg-brand-charcoal px-3.5 py-2 text-xs text-brand-white placeholder:text-brand-muted/60 focus:border-brand-gold focus:outline-none"
          />
          <Button type="submit" variant="primary" size="sm" disabled={sending || !draft.trim()}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
