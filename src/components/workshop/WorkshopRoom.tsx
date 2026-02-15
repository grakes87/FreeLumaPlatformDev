'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  MessageSquare,
  FileText,
  X,
  Loader2,
  Hand,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useWorkshopState } from '@/hooks/useWorkshopState';
import { useWorkshopChat, type ChatMessage } from '@/hooks/useWorkshopChat';
import { useWorkshopSocket } from '@/hooks/useWorkshopSocket';
import { WorkshopLobby } from '@/components/workshop/WorkshopLobby';
import { WorkshopVideo } from '@/components/workshop/WorkshopVideo';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkshopRoomProps {
  workshopId: number;
  onExit: () => void;
  onLiveStateChange?: (isLive: boolean) => void;
}

type SidebarTab = 'chat' | 'participants' | 'notes';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkshopRoom({
  workshopId,
  onExit,
  onLiveStateChange,
}: WorkshopRoomProps) {
  const router = useRouter();

  const {
    state,
    workshop,
    isHost,
    isCoHost,
    canSpeak,
    agoraToken,
    agoraChannel,
    agoraUid,
    agoraAppId,
    agoraRole,
    error,
    attendees,
    raisedHands,
    socketActions,
    startWorkshop,
    endWorkshop,
  } = useWorkshopState(workshopId);

  // Socket for chat (get raw socket from useWorkshopSocket)
  const { socket } = useWorkshopSocket(workshopId);
  const { messages, sendMessage } = useWorkshopChat(socket, workshopId);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [starting, setStarting] = useState(false);

  // Duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notify parent about live state
  useEffect(() => {
    onLiveStateChange?.(state === 'live');
  }, [state, onLiveStateChange]);

  // Duration timer for live state
  useEffect(() => {
    if (state === 'live') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  // Redirect to detail page when ended
  useEffect(() => {
    if (state === 'ended') {
      const timer = setTimeout(() => {
        router.push(`/workshops/${workshopId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state, router, workshopId]);

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await startWorkshop();
    } finally {
      setStarting(false);
    }
  }, [startWorkshop]);

  const handleEndWorkshop = useCallback(async () => {
    if (confirm('Are you sure you want to end the workshop for everyone?')) {
      await endWorkshop();
    }
  }, [endWorkshop]);

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // --- Loading state ---
  if (state === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/60" />
          <p className="mt-3 text-sm text-white/60">Joining workshop...</p>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (state === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 text-white">{error || 'Something went wrong'}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Ended state ---
  if (state === 'ended') {
    return (
      <div className="flex h-full w-full items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <LogOut className="h-8 w-8 text-white/60" />
          </div>
          <h2 className="text-xl font-bold text-white">Workshop Ended</h2>
          <p className="mt-2 text-sm text-white/50">
            Redirecting to workshop page...
          </p>
        </div>
      </div>
    );
  }

  // --- Lobby state ---
  if (state === 'lobby' && workshop) {
    return (
      <div className="flex h-full flex-col">
        {/* Lobby top bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3">
          <button
            type="button"
            onClick={onExit}
            className="rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 truncate text-sm font-semibold text-white">
            {workshop.title}
          </h2>
        </div>

        <WorkshopLobby
          workshop={workshop}
          isHost={isHost}
          attendees={attendees}
          onStart={handleStart}
          starting={starting}
        />
      </div>
    );
  }

  // --- Live state ---
  if (state === 'live' && workshop) {
    return (
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:text-white"
            aria-label="Leave workshop"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h2 className="flex-1 truncate text-sm font-semibold text-white">
            {workshop.title}
          </h2>

          {/* Duration */}
          <span className="shrink-0 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium tabular-nums text-red-400">
            LIVE {formatDuration(elapsedSeconds)}
          </span>

          {/* Attendee count */}
          <span className="shrink-0 flex items-center gap-1 text-xs text-white/50">
            <Users className="h-3.5 w-3.5" />
            {attendees.length}
          </span>

          {/* Sidebar toggle (mobile) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:text-white lg:hidden"
            aria-label="Toggle sidebar"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* End workshop (host) */}
          {isHost && (
            <button
              type="button"
              onClick={handleEndWorkshop}
              className="shrink-0 rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
            >
              End
            </button>
          )}
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Video area */}
          <div className={cn(
            'flex-1 min-w-0',
            sidebarOpen ? 'hidden lg:flex' : 'flex'
          )}>
            {agoraToken && agoraChannel && agoraUid != null && agoraAppId ? (
              <WorkshopVideo
                appId={agoraAppId}
                channelName={agoraChannel}
                token={agoraToken}
                uid={agoraUid}
                role={agoraRole}
                isHost={isHost}
                isCoHost={isCoHost}
                canSpeak={canSpeak}
                attendees={attendees}
                raisedHands={raisedHands}
                socketActions={socketActions}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/40" />
                  <p className="mt-2 text-xs text-white/40">Connecting video...</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div
            className={cn(
              'flex flex-col border-l border-white/10 bg-gray-900',
              // Desktop: always visible
              'lg:flex lg:w-[30%] lg:min-w-[280px] lg:max-w-[400px]',
              // Mobile: overlay
              sidebarOpen
                ? 'fixed inset-0 z-50 lg:relative lg:inset-auto'
                : 'hidden'
            )}
          >
            {/* Sidebar header */}
            <div className="flex h-10 shrink-0 items-center border-b border-white/10 px-2">
              {/* Tab buttons */}
              <SidebarTabButton
                active={sidebarTab === 'chat'}
                onClick={() => setSidebarTab('chat')}
                icon={<MessageSquare className="h-4 w-4" />}
                label="Chat"
              />
              <SidebarTabButton
                active={sidebarTab === 'participants'}
                onClick={() => setSidebarTab('participants')}
                icon={<Users className="h-4 w-4" />}
                label={`${attendees.length}`}
              />
              <SidebarTabButton
                active={sidebarTab === 'notes'}
                onClick={() => setSidebarTab('notes')}
                icon={<FileText className="h-4 w-4" />}
                label="Notes"
              />

              {/* Close (mobile) */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="ml-auto rounded-full p-1.5 text-white/60 transition-colors hover:text-white lg:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0">
              {sidebarTab === 'chat' && (
                <ChatPanel
                  messages={messages}
                  onSend={sendMessage}
                />
              )}
              {sidebarTab === 'participants' && (
                <ParticipantsPanel
                  attendees={attendees}
                  raisedHands={raisedHands}
                  isHost={isHost}
                  isCoHost={isCoHost}
                  socketActions={socketActions}
                />
              )}
              {sidebarTab === 'notes' && (
                <NotesPanel workshopId={workshopId} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (should not reach)
  return null;
}

// ---------------------------------------------------------------------------
// Sidebar sub-components
// ---------------------------------------------------------------------------

function SidebarTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
        active
          ? 'text-white bg-white/10'
          : 'text-white/50 hover:text-white/80'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

function ChatPanel({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/30">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-2">
              {msg.avatarUrl ? (
                <img
                  src={msg.avatarUrl}
                  alt=""
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="mt-0.5 shrink-0">
                  <InitialsAvatar
                    name={msg.displayName}
                    color="#6366f1"
                    size={24}
                    className="text-[10px]"
                  />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white/70">
                  {msg.displayName}
                </span>
                <p className="text-sm text-white/90 break-words">
                  {msg.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 gap-2 border-t border-white/10 p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Participants panel
// ---------------------------------------------------------------------------

function ParticipantsPanel({
  attendees,
  raisedHands,
  isHost,
  isCoHost,
  socketActions,
}: {
  attendees: import('@/hooks/useWorkshopSocket').AttendeeInfo[];
  raisedHands: number[];
  isHost: boolean;
  isCoHost: boolean;
  socketActions: {
    approveSpeaker: (userId: number) => void;
    revokeSpeaker: (userId: number) => void;
    promoteCoHost: (userId: number) => void;
    demoteCoHost: (userId: number) => void;
    muteUser: (userId: number) => void;
    removeUser: (userId: number) => void;
  };
}) {
  const canModerate = isHost || isCoHost;

  // Sort: host first, co-hosts next, then raised hands, then alphabetical
  const sorted = [...attendees].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    if (a.isCoHost !== b.isCoHost) return a.isCoHost ? -1 : 1;
    const aHand = raisedHands.includes(a.userId);
    const bHand = raisedHands.includes(b.userId);
    if (aHand !== bHand) return aHand ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="h-full overflow-y-auto">
      {/* Raised hands section */}
      {raisedHands.length > 0 && canModerate && (
        <div className="border-b border-white/10 px-3 py-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Hand className="h-3.5 w-3.5" />
            Raised Hands ({raisedHands.length})
          </p>
          {raisedHands.map((uid) => {
            const attendee = attendees.find((a) => a.userId === uid);
            if (!attendee) return null;
            return (
              <div key={uid} className="flex items-center justify-between py-1">
                <span className="text-xs text-white/80">{attendee.displayName}</span>
                <button
                  type="button"
                  onClick={() => socketActions.approveSpeaker(uid)}
                  className="rounded bg-green-600/30 px-2 py-0.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-600/50"
                >
                  Approve
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* All participants */}
      <div className="px-3 py-2 space-y-1">
        {sorted.map((attendee) => (
          <div key={attendee.userId} className="flex items-center gap-2 py-1.5">
            {attendee.avatarUrl ? (
              <img
                src={attendee.avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <InitialsAvatar
                name={attendee.displayName}
                color="#6366f1"
                size={28}
                className="text-[10px]"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs text-white/80 truncate block">
                {attendee.displayName}
              </span>
            </div>
            {/* Role badges */}
            {attendee.isHost && (
              <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                HOST
              </span>
            )}
            {attendee.isCoHost && !attendee.isHost && (
              <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                CO-HOST
              </span>
            )}
            {attendee.canSpeak && !attendee.isHost && !attendee.isCoHost && (
              <span className="shrink-0 rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                SPEAKER
              </span>
            )}
            {raisedHands.includes(attendee.userId) && (
              <Hand className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes panel (placeholder — uses /api/workshops/[id]/notes)
// ---------------------------------------------------------------------------

function NotesPanel({ workshopId }: { workshopId: number }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load notes on mount
  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      try {
        const res = await fetch(`/api/workshops/${workshopId}/notes`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data ?? json;
          if (!cancelled) {
            setNotes(data.notes || '');
          }
        }
      } catch {
        // Non-fatal
      }
    }

    loadNotes();
    return () => { cancelled = true; };
  }, [workshopId]);

  const saveNotes = useCallback(
    async (text: string) => {
      setSaving(true);
      try {
        await fetch(`/api/workshops/${workshopId}/notes`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: text }),
        });
      } catch {
        // Non-fatal
      } finally {
        setSaving(false);
      }
    },
    [workshopId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1500);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-semibold text-white/60">Personal Notes</span>
        {saving && (
          <span className="text-[10px] text-white/40">Saving...</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Jot down your notes here..."
        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white/90 placeholder-white/30 outline-none"
      />
    </div>
  );
}
