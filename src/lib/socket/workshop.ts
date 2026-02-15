import type { Namespace, Socket } from 'socket.io';

/** Simple per-socket sliding-window rate limiter. */
function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const timestamps: number[] = [];
  return (): boolean => {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= maxPerWindow) return false;
    timestamps.push(now);
    return true;
  };
}

/**
 * Register all /workshop namespace event handlers on a connected socket.
 * Handles: room join/leave, raise hand, speaker management, co-host promotion,
 * mute/remove, in-room chat, and workshop state broadcasting.
 */
export function registerWorkshopHandlers(nsp: Namespace, socket: Socket): void {
  const userId = socket.data.userId as number;

  // Per-socket rate limiters
  const chatLimiter = createRateLimiter(10, 5000);    // 10 messages per 5s
  const handLimiter = createRateLimiter(5, 10000);     // 5 hand raises per 10s

  // Track which workshop rooms this socket has joined (for disconnect cleanup)
  const activeWorkshops = new Set<number>();

  // ---- Helper: Validate caller is host or co-host ----
  async function isHostOrCoHost(workshopId: number, callerUserId: number): Promise<boolean> {
    const { Workshop, WorkshopAttendee } = await import('@/lib/db/models');
    const workshop = await Workshop.findByPk(workshopId, { attributes: ['id', 'host_id'] });
    if (!workshop) return false;
    if (workshop.host_id === callerUserId) return true;
    const attendee = await WorkshopAttendee.findOne({
      where: { workshop_id: workshopId, user_id: callerUserId, is_co_host: true },
      attributes: ['id'],
    });
    return !!attendee;
  }

  // ---- Helper: Validate caller is host (not co-host) ----
  async function isHost(workshopId: number, callerUserId: number): Promise<boolean> {
    const { Workshop } = await import('@/lib/db/models');
    const workshop = await Workshop.findByPk(workshopId, { attributes: ['id', 'host_id'] });
    return !!workshop && workshop.host_id === callerUserId;
  }

  // -------------------------------------------------------------------------
  // workshop:join — join a workshop room
  // -------------------------------------------------------------------------
  socket.on('workshop:join', async ({ workshopId }: { workshopId: number }) => {
    try {
      const { Workshop, WorkshopAttendee, WorkshopInvite, User } =
        await import('@/lib/db/models');

      // Validate workshop exists and is in valid state
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'status', 'host_id', 'is_private', 'actual_started_at'],
      });
      if (!workshop) {
        socket.emit('workshop:error', { event: 'join', message: 'Workshop not found' });
        return;
      }
      if (!['scheduled', 'lobby', 'live'].includes(workshop.status)) {
        socket.emit('workshop:error', { event: 'join', message: 'Workshop is not active' });
        return;
      }

      // Validate user is host, co-host, RSVP'd, or invited (for private)
      const isHostUser = workshop.host_id === userId;
      let attendee = await WorkshopAttendee.findOne({
        where: { workshop_id: workshopId, user_id: userId },
      });

      if (!isHostUser && !attendee) {
        // Check if user is invited (for private workshops) or if workshop is public
        if (workshop.is_private) {
          const invite = await WorkshopInvite.findOne({
            where: { workshop_id: workshopId, user_id: userId },
            attributes: ['id'],
          });
          if (!invite) {
            socket.emit('workshop:error', { event: 'join', message: 'Not authorized to join' });
            return;
          }
        }
        // Auto-create attendee record for non-RSVP'd users joining a public workshop
        attendee = await WorkshopAttendee.create({
          workshop_id: workshopId,
          user_id: userId,
        });
      }

      // Join socket room
      socket.join(`workshop:${workshopId}`);
      activeWorkshops.add(workshopId);

      // If workshop is live or lobby, update attendee status
      if ((workshop.status === 'live' || workshop.status === 'lobby') && attendee) {
        await attendee.update({
          status: 'joined',
          joined_at: attendee.joined_at ?? new Date(),
        });
      }

      // Get user info for broadcast
      const user = await User.findByPk(userId, {
        attributes: ['id', 'display_name', 'avatar_url'],
      });
      const displayName = user?.display_name ?? 'Unknown';
      const avatarUrl = user?.avatar_url ?? null;

      // Broadcast user-joined to room (excluding sender)
      socket.to(`workshop:${workshopId}`).emit('workshop:user-joined', {
        userId,
        displayName,
        avatarUrl,
        isHost: isHostUser,
        isCoHost: attendee?.is_co_host ?? false,
        canSpeak: attendee?.can_speak ?? false,
      });

      // Build current attendees list for the joining user
      const attendees = await WorkshopAttendee.findAll({
        where: { workshop_id: workshopId, status: 'joined' },
        include: [{ model: User, as: 'user', attributes: ['id', 'display_name', 'avatar_url'] }],
      });

      const coHostIds: number[] = [];
      const attendeeList = attendees.map((a) => {
        if (a.is_co_host) coHostIds.push(a.user_id);
        const u = (a as unknown as { user?: { display_name: string; avatar_url: string | null } }).user;
        return {
          userId: a.user_id,
          displayName: u?.display_name ?? 'Unknown',
          avatarUrl: u?.avatar_url ?? null,
          isHost: a.user_id === workshop.host_id,
          isCoHost: a.is_co_host,
          canSpeak: a.can_speak,
        };
      });

      // Send current state to the joining user
      socket.emit('workshop:state', {
        status: workshop.status,
        attendees: attendeeList,
        hostId: workshop.host_id,
        coHostIds,
        startedAt: workshop.actual_started_at?.toISOString() ?? null,
      });
    } catch (err) {
      console.error('[Workshop] workshop:join error:', err);
      socket.emit('workshop:error', { event: 'join', message: 'Failed to join workshop' });
    }
  });

  // -------------------------------------------------------------------------
  // workshop:leave — leave a workshop room
  // -------------------------------------------------------------------------
  socket.on('workshop:leave', async ({ workshopId }: { workshopId: number }) => {
    try {
      socket.leave(`workshop:${workshopId}`);
      activeWorkshops.delete(workshopId);

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { status: 'left', left_at: new Date() },
        { where: { workshop_id: workshopId, user_id: userId } }
      );

      socket.to(`workshop:${workshopId}`).emit('workshop:user-left', { userId });
    } catch (err) {
      console.error('[Workshop] workshop:leave error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:raise-hand — attendee requests to speak
  // -------------------------------------------------------------------------
  socket.on('workshop:raise-hand', async ({ workshopId }: { workshopId: number }) => {
    if (!handLimiter()) return;
    if (!socket.rooms.has(`workshop:${workshopId}`)) return;
    nsp.to(`workshop:${workshopId}`).emit('workshop:hand-raised', { userId });
  });

  // -------------------------------------------------------------------------
  // workshop:lower-hand — attendee cancels speak request
  // -------------------------------------------------------------------------
  socket.on('workshop:lower-hand', async ({ workshopId }: { workshopId: number }) => {
    if (!handLimiter()) return;
    if (!socket.rooms.has(`workshop:${workshopId}`)) return;
    nsp.to(`workshop:${workshopId}`).emit('workshop:hand-lowered', { userId });
  });

  // -------------------------------------------------------------------------
  // workshop:approve-speaker — host/co-host approves attendee to speak
  // -------------------------------------------------------------------------
  socket.on('workshop:approve-speaker', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHostOrCoHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'approve-speaker', message: 'Not authorized' });
        return;
      }

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { can_speak: true },
        { where: { workshop_id: workshopId, user_id: targetUserId } }
      );

      nsp.to(`workshop:${workshopId}`).emit('workshop:speaker-approved', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:approve-speaker error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:revoke-speaker — host/co-host revokes attendee speaking rights
  // -------------------------------------------------------------------------
  socket.on('workshop:revoke-speaker', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHostOrCoHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'revoke-speaker', message: 'Not authorized' });
        return;
      }

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { can_speak: false },
        { where: { workshop_id: workshopId, user_id: targetUserId } }
      );

      nsp.to(`workshop:${workshopId}`).emit('workshop:speaker-revoked', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:revoke-speaker error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:promote-cohost — host promotes attendee to co-host
  // -------------------------------------------------------------------------
  socket.on('workshop:promote-cohost', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'promote-cohost', message: 'Only the host can promote co-hosts' });
        return;
      }

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { is_co_host: true, can_speak: true },
        { where: { workshop_id: workshopId, user_id: targetUserId } }
      );

      nsp.to(`workshop:${workshopId}`).emit('workshop:cohost-promoted', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:promote-cohost error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:demote-cohost — host demotes co-host back to attendee
  // -------------------------------------------------------------------------
  socket.on('workshop:demote-cohost', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'demote-cohost', message: 'Only the host can demote co-hosts' });
        return;
      }

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { is_co_host: false },
        { where: { workshop_id: workshopId, user_id: targetUserId } }
      );

      nsp.to(`workshop:${workshopId}`).emit('workshop:cohost-demoted', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:demote-cohost error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:mute-user — host/co-host mutes an attendee (client handles Agora)
  // -------------------------------------------------------------------------
  socket.on('workshop:mute-user', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHostOrCoHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'mute-user', message: 'Not authorized' });
        return;
      }

      nsp.to(`workshop:${workshopId}`).emit('workshop:user-muted', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:mute-user error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:remove-user — host/co-host removes an attendee from workshop
  // -------------------------------------------------------------------------
  socket.on('workshop:remove-user', async ({ workshopId, targetUserId }: { workshopId: number; targetUserId: number }) => {
    try {
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;
      if (!(await isHostOrCoHost(workshopId, userId))) {
        socket.emit('workshop:error', { event: 'remove-user', message: 'Not authorized' });
        return;
      }

      const { WorkshopAttendee } = await import('@/lib/db/models');
      await WorkshopAttendee.update(
        { status: 'left', left_at: new Date() },
        { where: { workshop_id: workshopId, user_id: targetUserId } }
      );

      nsp.to(`workshop:${workshopId}`).emit('workshop:user-removed', { userId: targetUserId });
    } catch (err) {
      console.error('[Workshop] workshop:remove-user error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:chat — in-room chat message
  // -------------------------------------------------------------------------
  socket.on('workshop:chat', async ({ workshopId, message }: { workshopId: number; message: string }) => {
    try {
      if (!chatLimiter()) return;
      if (!socket.rooms.has(`workshop:${workshopId}`)) return;

      // Validate message
      if (!message || typeof message !== 'string') return;
      const trimmed = message.trim();
      if (trimmed.length === 0 || trimmed.length > 1000) return;

      const { Workshop, WorkshopChat, User } = await import('@/lib/db/models');

      // Get workshop for offset calculation
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'status', 'actual_started_at'],
      });
      if (!workshop) return;

      // Calculate offset_ms from workshop start (for chat replay)
      let offsetMs = 0;
      if (workshop.status === 'live' && workshop.actual_started_at) {
        offsetMs = Date.now() - workshop.actual_started_at.getTime();
      }

      // Persist chat message
      const chatRow = await WorkshopChat.create({
        workshop_id: workshopId,
        user_id: userId,
        message: trimmed,
        offset_ms: offsetMs,
      });

      // Get user info for broadcast
      const user = await User.findByPk(userId, {
        attributes: ['id', 'display_name', 'avatar_url'],
      });

      // Broadcast to entire room (including sender for echo confirmation)
      nsp.to(`workshop:${workshopId}`).emit('workshop:chat-message', {
        id: chatRow.id,
        userId,
        displayName: user?.display_name ?? 'Unknown',
        avatarUrl: user?.avatar_url ?? null,
        message: trimmed,
        offsetMs,
        createdAt: chatRow.created_at.toISOString(),
      });
    } catch (err) {
      console.error('[Workshop] workshop:chat error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // workshop:state-change — INTERNAL event from server (start/end API routes)
  // -------------------------------------------------------------------------
  socket.on('workshop:state-change', async ({ workshopId, newStatus }: { workshopId: number; newStatus: string }) => {
    // This event is for server-side emission only (from API routes via getIO())
    // Validate caller is host
    try {
      if (!(await isHost(workshopId, userId))) return;

      const { Workshop } = await import('@/lib/db/models');
      const workshop = await Workshop.findByPk(workshopId, {
        attributes: ['id', 'status', 'actual_started_at', 'actual_ended_at'],
      });
      if (!workshop) return;

      nsp.to(`workshop:${workshopId}`).emit('workshop:state-changed', {
        status: newStatus,
        startedAt: workshop.actual_started_at?.toISOString() ?? null,
        endedAt: workshop.actual_ended_at?.toISOString() ?? null,
      });
    } catch (err) {
      console.error('[Workshop] workshop:state-change error:', err);
    }
  });

  // -------------------------------------------------------------------------
  // disconnect — clean up workshop room memberships
  // -------------------------------------------------------------------------
  socket.on('disconnect', async () => {
    for (const workshopId of activeWorkshops) {
      try {
        const { WorkshopAttendee } = await import('@/lib/db/models');
        await WorkshopAttendee.update(
          { status: 'left', left_at: new Date() },
          { where: { workshop_id: workshopId, user_id: userId, status: 'joined' } }
        );

        nsp.to(`workshop:${workshopId}`).emit('workshop:user-left', { userId });
      } catch (err) {
        console.error('[Workshop] disconnect cleanup error:', err);
      }
    }
    activeWorkshops.clear();
  });
}
