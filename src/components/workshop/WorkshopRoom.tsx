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
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useWorkshopState } from '@/hooks/useWorkshopState';
import { useWorkshopChat, type ChatMessage } from '@/hooks/useWorkshopChat';
import { WorkshopLobby } from '@/components/workshop/WorkshopLobby';
import { WorkshopVideo } from '@/components/workshop/WorkshopVideo';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
    socket,
    attendees,
    raisedHands,
    socketActions,
    banUser,
    startWorkshop,
    endWorkshop,
  } = useWorkshopState(workshopId);

  // Chat uses the same socket — no duplicate connection
  const { messages, sendMessage } = useWorkshopChat(socket, workshopId);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [starting, setStarting] = useState(false);

  // Track previous raised hand count to detect new raises
  const prevRaisedHandCountRef = useRef(0);
  const [handAlert, setHandAlert] = useState(false);

  // End workshop confirmation
  const [showEndConfirm, setShowEndConfirm] = useState(false);

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

  // Alert host/co-host when new hands are raised
  useEffect(() => {
    if (!isHost && !isCoHost) return;
    const prevCount = prevRaisedHandCountRef.current;
    const newCount = raisedHands.length;
    if (newCount > prevCount && prevCount >= 0) {
      setHandAlert(true);
      // Auto-dismiss after 5s
      const timer = setTimeout(() => setHandAlert(false), 5000);
      prevRaisedHandCountRef.current = newCount;
      return () => clearTimeout(timer);
    }
    prevRaisedHandCountRef.current = newCount;
  }, [raisedHands.length, isHost, isCoHost]);

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

  const handleEndRequest = useCallback(() => {
    setShowEndConfirm(true);
  }, []);

  const handleEndConfirm = useCallback(async () => {
    await endWorkshop();
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
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-text-muted dark:text-white/60" />
          <p className="mt-3 text-sm text-text-muted dark:text-white/60">Joining workshop...</p>
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
          <p className="mt-3 text-text dark:text-white">{error || 'Something went wrong'}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
            <LogOut className="h-8 w-8 text-text-muted dark:text-white/60" />
          </div>
          <h2 className="text-xl font-bold text-text dark:text-white">Workshop Ended</h2>
          <p className="mt-2 text-sm text-text-muted dark:text-white/50">
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
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border dark:border-white/10 px-3">
          <button
            type="button"
            onClick={onExit}
            className="rounded-full p-1.5 text-text-muted transition-colors hover:text-text dark:text-white/60 dark:hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex-1 truncate text-sm font-semibold text-text dark:text-white">
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
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border dark:border-white/10 px-3">
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:text-text dark:text-white/60 dark:hover:text-white"
            aria-label="Leave workshop"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h2 className="flex-1 truncate text-sm font-semibold text-text dark:text-white">
            {workshop.title}
          </h2>

          {/* Duration */}
          <span className="shrink-0 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium tabular-nums text-red-400">
            LIVE {formatDuration(elapsedSeconds)}
          </span>

          {/* Attendee count + raised hand indicator */}
          <button
            type="button"
            onClick={() => {
              if (raisedHands.length > 0 && (isHost || isCoHost)) {
                setSidebarOpen(true);
                setSidebarTab('participants');
                setHandAlert(false);
              }
            }}
            className={cn(
              'shrink-0 flex items-center gap-1 text-xs',
              raisedHands.length > 0 && (isHost || isCoHost)
                ? 'text-amber-400 animate-pulse cursor-pointer'
                : 'text-text-muted dark:text-white/50 cursor-default'
            )}
          >
            {raisedHands.length > 0 && (isHost || isCoHost) ? (
              <>
                <Hand className="h-3.5 w-3.5" />
                {raisedHands.length}
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5" />
                {attendees.length}
              </>
            )}
          </button>

          {/* Sidebar toggle (mobile) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 rounded-full p-1.5 text-text-muted transition-colors hover:text-text dark:text-white/60 dark:hover:text-white lg:hidden"
            aria-label="Toggle sidebar"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* End workshop (host) */}
          {isHost && (
            <button
              type="button"
              onClick={handleEndRequest}
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
            'relative flex-1 min-w-0',
            sidebarOpen ? 'hidden lg:flex' : 'flex'
          )}>
            {/* Floating action buttons (mobile) */}
            {!sidebarOpen && (
              <div className="absolute bottom-20 right-3 z-10 flex flex-col gap-2 lg:hidden">
                {/* Raised hand alert */}
                {raisedHands.length > 0 && (isHost || isCoHost) && (
                  <button
                    type="button"
                    onClick={() => { setSidebarOpen(true); setSidebarTab('participants'); setHandAlert(false); }}
                    className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-white shadow-lg animate-pulse"
                  >
                    <Hand className="h-4 w-4" />
                    <span className="text-sm font-medium">{raisedHands.length} Hand{raisedHands.length > 1 ? 's' : ''}</span>
                  </button>
                )}
                {/* Chat button */}
                <button
                  type="button"
                  onClick={() => { setSidebarOpen(true); setSidebarTab('chat'); }}
                  className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-white shadow-lg transition-colors hover:bg-primary/90"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-sm font-medium">Chat</span>
                </button>
              </div>
            )}

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
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-text-muted dark:text-white/40" />
                  <p className="mt-2 text-xs text-text-muted dark:text-white/40">Connecting video...</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div
            className={cn(
              'flex flex-col border-l border-border dark:border-white/10 bg-surface dark:bg-gray-900 transition-transform duration-200',
              // Desktop: always visible
              'lg:flex lg:w-[30%] lg:min-w-[280px] lg:max-w-[400px]',
              // Mobile: overlay
              sidebarOpen
                ? 'fixed inset-0 z-50 lg:relative lg:inset-auto'
                : 'hidden'
            )}
          >
            {/* Sidebar header */}
            <div className="flex h-10 shrink-0 items-center border-b border-border dark:border-white/10 px-2">
              {/* Tab buttons */}
              <SidebarTabButton
                active={sidebarTab === 'chat'}
                onClick={() => setSidebarTab('chat')}
                icon={<MessageSquare className="h-4 w-4" />}
                label="Chat"
              />
              <SidebarTabButton
                active={sidebarTab === 'participants'}
                onClick={() => { setSidebarTab('participants'); setHandAlert(false); }}
                icon={<Users className="h-4 w-4" />}
                label={`${attendees.length}`}
                badge={raisedHands.length > 0 && (isHost || isCoHost) ? raisedHands.length : undefined}
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
                className="ml-auto rounded-full p-1.5 text-text-muted dark:text-white/60 transition-colors hover:text-text dark:hover:text-white lg:hidden"
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
                  banUser={banUser}
                />
              )}
              {sidebarTab === 'notes' && (
                <NotesPanel workshopId={workshopId} />
              )}
            </div>
          </div>
        </div>

        {/* End workshop confirmation */}
        <ConfirmDialog
          isOpen={showEndConfirm}
          onClose={() => setShowEndConfirm(false)}
          onConfirm={handleEndConfirm}
          title="End Workshop"
          message="Are you sure you want to end the workshop for everyone? This cannot be undone."
          confirmLabel="End Workshop"
          cancelLabel="Continue"
          danger
        />
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
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
        active
          ? 'text-text dark:text-white bg-gray-100 dark:bg-white/10'
          : 'text-text-muted dark:text-white/50 hover:text-text dark:hover:text-white/80'
      )}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
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
          <p className="py-8 text-center text-xs text-text-muted/50 dark:text-white/30">
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
                <span className="text-xs font-semibold text-text-muted dark:text-white/70">
                  {msg.displayName}
                </span>
                <p className="text-sm text-text dark:text-white/90 break-words">
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
        className="flex shrink-0 gap-2 border-t border-border dark:border-white/10 p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-2 text-sm text-text dark:text-white placeholder-text-muted/50 dark:placeholder-white/30 outline-none focus:ring-1 focus:ring-primary"
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
  banUser,
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
  banUser: (targetUserId: number, reason?: string) => void;
}) {
  const canModerate = isHost || isCoHost;
  const [kickTarget, setKickTarget] = useState<{ userId: number; name: string } | null>(null);
  const [banTarget, setBanTarget] = useState<{ userId: number; name: string } | null>(null);

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
        <div className="border-b border-border dark:border-white/10 px-3 py-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <Hand className="h-3.5 w-3.5" />
            Raised Hands ({raisedHands.length})
          </p>
          {raisedHands.map((uid) => {
            const attendee = attendees.find((a) => a.userId === uid);
            if (!attendee) return null;
            return (
              <div key={uid} className="flex items-center justify-between py-1">
                <span className="text-xs text-text dark:text-white/80">{attendee.displayName}</span>
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
      <div className="px-3 py-2 space-y-0.5">
        {sorted.map((attendee) => (
          <div key={attendee.userId} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-white/5">
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
              <span className="text-xs text-text dark:text-white/80 truncate block">
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

            {/* Moderation actions (host/co-host only, not on host themselves) */}
            {canModerate && !attendee.isHost && (
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {/* Kick button */}
                <button
                  type="button"
                  onClick={() => setKickTarget({ userId: attendee.userId, name: attendee.displayName })}
                  className="rounded p-1 text-text-muted/50 dark:text-white/40 transition-colors hover:bg-gray-100 dark:hover:bg-white/10 hover:text-text dark:hover:text-white/80"
                  title="Kick"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>

                {/* Ban button (host only) */}
                {isHost && (
                  <button
                    type="button"
                    onClick={() => setBanTarget({ userId: attendee.userId, name: attendee.displayName })}
                    className="rounded p-1 text-text-muted/50 dark:text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                    title="Ban from all your workshops"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Kick confirmation */}
      {kickTarget && (
        <ConfirmDialog
          isOpen
          onClose={() => setKickTarget(null)}
          onConfirm={() => {
            socketActions.removeUser(kickTarget.userId);
            setKickTarget(null);
          }}
          title="Kick Attendee"
          message={`Remove ${kickTarget.name} from the workshop? They can rejoin later.`}
          confirmLabel="Kick"
          cancelLabel="Cancel"
          danger
        />
      )}

      {/* Ban confirmation */}
      {banTarget && (
        <ConfirmDialog
          isOpen
          onClose={() => setBanTarget(null)}
          onConfirm={() => {
            banUser(banTarget.userId);
            setBanTarget(null);
          }}
          title="Ban from All Your Workshops"
          message={`Ban ${banTarget.name} from all your workshops? They will be removed from this session and unable to join any of your future workshops.`}
          confirmLabel="Ban"
          cancelLabel="Cancel"
          danger
        />
      )}
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-white/10">
        <span className="text-xs font-semibold text-text-muted dark:text-white/60">Personal Notes</span>
        {saving && (
          <span className="text-[10px] text-text-muted/50 dark:text-white/40">Saving...</span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Jot down your notes here..."
        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-text dark:text-white/90 placeholder-text-muted/50 dark:placeholder-white/30 outline-none"
      />
    </div>
  );
}
