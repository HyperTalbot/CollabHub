// frontend/hooks/usePendingRequests.ts
import { useState, useEffect, useCallback } from 'react';
import axiosMessenger from '@/lib/axiosMessenger';

export function usePendingRequests() {
  const [friends, setFriends] = useState(0);
  const [invites, setInvites] = useState(0);

  const refresh = useCallback(async () => {
    const [fr, si] = await Promise.all([
      axiosMessenger.get('/friends/requests').catch(() => null),
      axiosMessenger.get('/server-invites').catch(() => null),
    ]);
    setFriends(fr?.data?.requests?.length || 0);
    setInvites(si?.data?.invites?.length || 0);
  }, []);

  useEffect(() => {
    refresh();

    // мгновенная реакция на WS-события
    const onFriendRequest = () => refresh();
    const onServerInvite = () => refresh();
    const onRequestsUpdated = () => refresh(); // после принятия/отклонения

    window.addEventListener('friend-request', onFriendRequest);
    window.addEventListener('server-invite', onServerInvite);
    window.addEventListener('requests-updated', onRequestsUpdated);

    // страховка: лёгкий поллинг (если backend пока не шлёт friend_request по WS)
    const timer = setInterval(refresh, 30000);

    return () => {
      window.removeEventListener('friend-request', onFriendRequest);
      window.removeEventListener('server-invite', onServerInvite);
      window.removeEventListener('requests-updated', onRequestsUpdated);
      clearInterval(timer);
    };
  }, [refresh]);

  return { friends, invites, total: friends + invites, refresh };
}