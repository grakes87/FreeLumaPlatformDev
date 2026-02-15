'use client';

import { useState } from 'react';
import {
  Crown,
  Star,
  Mic,
  Hand,
  MoreVertical,
  UserMinus,
  MicOff,
  ShieldPlus,
  ShieldMinus,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { InitialsAvatar } from '@/components/profile/InitialsAvatar';
import type { AttendeeInfo } from '@/hooks/useWorkshopSocket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkshopParticipantsProps {
  attendees: AttendeeInfo[];
  raisedHands: number[];
  isHost: boolean;
  isCoHost: boolean;
  currentUserId: number;
  onRaiseHand: () => void;
  onLowerHand: () => void;
  onApproveSpeaker: (userId: number) => void;
  onRevokeSpeaker: (userId: number) => void;
  onPromoteCoHost: (userId: number) => void;
  onDemoteCoHost: (userId: number) => void;
  onMuteUser: (userId: number) => void;
  onRemoveUser: (userId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AttendeeGroup = 'host' | 'cohost' | 'speaking' | 'raised' | 'audience';

function getGroup(
  attendee: AttendeeInfo,
  raisedHands: number[]
): AttendeeGroup {
  if (attendee.isHost) return 'host';
  if (attendee.isCoHost) return 'cohost';
  if (attendee.canSpeak) return 'speaking';
  if (raisedHands.includes(attendee.userId)) return 'raised';
  return 'audience';
}

const GROUP_ORDER: AttendeeGroup[] = [
  'host',
  'cohost',
  'speaking',
  'raised',
  'audience',
];

function sortAttendees(
  attendees: AttendeeInfo[],
  raisedHands: number[]
): AttendeeInfo[] {
  return [...attendees].sort((a, b) => {
    const aGroup = GROUP_ORDER.indexOf(getGroup(a, raisedHands));
    const bGroup = GROUP_ORDER.indexOf(getGroup(b, raisedHands));
    if (aGroup !== bGroup) return aGroup - bGroup;
    return a.displayName.localeCompare(b.displayName);
  });
}

// ---------------------------------------------------------------------------
// Attendee Action Menu
// ---------------------------------------------------------------------------

interface AttendeeMenuProps {
  attendee: AttendeeInfo;
  isHost: boolean;
  isCoHost: boolean;
  hasRaisedHand: boolean;
  onApproveSpeaker: (userId: number) => void;
  onRevokeSpeaker: (userId: number) => void;
  onPromoteCoHost: (userId: number) => void;
  onDemoteCoHost: (userId: number) => void;
  onMuteUser: (userId: number) => void;
  onRemoveUser: (userId: number) => void;
}

function AttendeeMenu({
  attendee,
  isHost,
  isCoHost,
  hasRaisedHand,
  onApproveSpeaker,
  onRevokeSpeaker,
  onPromoteCoHost,
  onDemoteCoHost,
  onMuteUser,
  onRemoveUser,
}: AttendeeMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Cannot manage the host
  if (attendee.isHost) return null;
  // Co-hosts can manage attendees but not other co-hosts
  if (isCoHost && !isHost && attendee.isCoHost) return null;

  const menuItems: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean }[] = [];

  // Speaking controls
  if (hasRaisedHand && !attendee.canSpeak) {
    menuItems.push({
      label: 'Approve to Speak',
      icon: <Volume2 className="h-3.5 w-3.5" />,
      action: () => { onApproveSpeaker(attendee.userId); setOpen(false); },
    });
  }
  if (attendee.canSpeak && !attendee.isCoHost) {
    menuItems.push({
      label: 'Revoke Speaking',
      icon: <VolumeX className="h-3.5 w-3.5" />,
      action: () => { onRevokeSpeaker(attendee.userId); setOpen(false); },
    });
  }

  // Co-host promotion (host only)
  if (isHost && !attendee.isCoHost) {
    menuItems.push({
      label: 'Promote to Co-Host',
      icon: <ShieldPlus className="h-3.5 w-3.5" />,
      action: () => { onPromoteCoHost(attendee.userId); setOpen(false); },
    });
  }
  if (isHost && attendee.isCoHost) {
    menuItems.push({
      label: 'Demote Co-Host',
      icon: <ShieldMinus className="h-3.5 w-3.5" />,
      action: () => { onDemoteCoHost(attendee.userId); setOpen(false); },
    });
  }

  // Mute
  menuItems.push({
    label: 'Mute',
    icon: <MicOff className="h-3.5 w-3.5" />,
    action: () => { onMuteUser(attendee.userId); setOpen(false); },
  });

  // Remove
  menuItems.push({
    label: 'Remove from Workshop',
    icon: <UserMinus className="h-3.5 w-3.5" />,
    danger: true,
    action: () => setConfirmRemove(true),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setConfirmRemove(false); }}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
        aria-label={`Actions for ${attendee.displayName}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => { setOpen(false); setConfirmRemove(false); }}
          />

          <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-600 bg-slate-800 py-1 shadow-lg">
            {confirmRemove ? (
              <div className="px-3 py-2">
                <p className="mb-2 text-xs text-slate-300">
                  Remove {attendee.displayName} from this workshop?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveUser(attendee.userId);
                      setOpen(false);
                      setConfirmRemove(false);
                    }}
                    className="flex-1 rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                    item.danger
                      ? 'text-red-400 hover:bg-red-500/10'
                      : 'text-slate-300 hover:bg-slate-700'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role Badge
// ---------------------------------------------------------------------------

function RoleBadge({ group }: { group: AttendeeGroup }) {
  switch (group) {
    case 'host':
      return <Crown className="h-3.5 w-3.5 text-amber-400" />;
    case 'cohost':
      return <Star className="h-3.5 w-3.5 text-indigo-400" />;
    case 'speaking':
      return <Mic className="h-3.5 w-3.5 text-green-400" />;
    case 'raised':
      return <Hand className="h-3.5 w-3.5 animate-pulse text-orange-400" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Live attendee list with role grouping and raise hand functionality.
 * Hosts/co-hosts see action menus for attendee management.
 */
export function WorkshopParticipants({
  attendees,
  raisedHands,
  isHost,
  isCoHost,
  currentUserId,
  onRaiseHand,
  onLowerHand,
  onApproveSpeaker,
  onRevokeSpeaker,
  onPromoteCoHost,
  onDemoteCoHost,
  onMuteUser,
  onRemoveUser,
}: WorkshopParticipantsProps) {
  const canManage = isHost || isCoHost;
  const hasRaisedHand = raisedHands.includes(currentUserId);
  const sorted = sortAttendees(attendees, raisedHands);

  // Group label tracking
  let lastGroup: AttendeeGroup | null = null;

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Participants ({attendees.length})
          </h3>
        </div>
      </div>

      {/* Raise hand button (for non-host/non-cohost attendees) */}
      {!isHost && !isCoHost && (
        <div className="flex-shrink-0 border-b border-slate-700 px-3 py-2">
          <button
            type="button"
            onClick={hasRaisedHand ? onLowerHand : onRaiseHand}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              hasRaisedHand
                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            <Hand className={cn('h-4 w-4', hasRaisedHand && 'animate-pulse')} />
            {hasRaisedHand ? 'Lower Hand' : 'Raise Hand'}
          </button>
        </div>
      )}

      {/* Attendee list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
        {sorted.map((attendee) => {
          const group = getGroup(attendee, raisedHands);
          const showGroupLabel = group !== lastGroup;
          lastGroup = group;

          // Only show "Raised Hands" group to host/co-host
          const isRaisedGroup = group === 'raised';
          if (isRaisedGroup && !canManage) return null;

          return (
            <div key={attendee.userId}>
              {/* Group label */}
              {showGroupLabel && (
                <div className="mb-1 mt-3 first:mt-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group === 'host' && 'Host'}
                    {group === 'cohost' && 'Co-Hosts'}
                    {group === 'speaking' && 'Speakers'}
                    {group === 'raised' && 'Raised Hands'}
                    {group === 'audience' && 'Audience'}
                  </span>
                </div>
              )}

              {/* Attendee row */}
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5',
                  attendee.userId === currentUserId && 'bg-slate-800/50'
                )}
              >
                {/* Avatar */}
                {attendee.avatarUrl ? (
                  <img
                    src={attendee.avatarUrl}
                    alt={attendee.displayName}
                    className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar
                    name={attendee.displayName}
                    color="#6366f1"
                    size={28}
                    className="flex-shrink-0 text-[10px]"
                  />
                )}

                {/* Name + badge */}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-sm text-slate-200">
                    {attendee.displayName}
                    {attendee.userId === currentUserId && (
                      <span className="ml-1 text-xs text-slate-500">(you)</span>
                    )}
                  </span>
                  <RoleBadge group={group} />
                </div>

                {/* Action menu (for host/co-host, not for self) */}
                {canManage && attendee.userId !== currentUserId && (
                  <AttendeeMenu
                    attendee={attendee}
                    isHost={isHost}
                    isCoHost={isCoHost}
                    hasRaisedHand={raisedHands.includes(attendee.userId)}
                    onApproveSpeaker={onApproveSpeaker}
                    onRevokeSpeaker={onRevokeSpeaker}
                    onPromoteCoHost={onPromoteCoHost}
                    onDemoteCoHost={onDemoteCoHost}
                    onMuteUser={onMuteUser}
                    onRemoveUser={onRemoveUser}
                  />
                )}
              </div>
            </div>
          );
        })}

        {attendees.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">
            No one has joined yet
          </p>
        )}
      </div>
    </div>
  );
}
