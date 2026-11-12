"use client";

import { useCallback } from "react";
import { useDisconnect } from "wagmi";

/**
 * End the session — both halves of it.
 *
 * Signing out used to mean `clearAuthToken()` and a router push, which left
 * the wallet connected. wagmi persists its connection in local storage and
 * reconnects on load, so the next person to open the browser — or the next
 * account to sign in on a shared laptop — arrived with the previous user's
 * wallet already attached and ready to sign. On a phone handed round between
 * people, that is somebody else's funds one tap away.
 *
 * It also lived only at the bottom of Settings → Account. There was no sign
 * out in the account menu at all, which is the first place anyone looks.
 *
 * `disconnect()` is awaited before the token is dropped so the wallet is gone
 * before the page changes, and the navigation is a full load rather than a
 * client-side push: React state does not survive it, so no fragment of the
 * previous session's profile, notifications or wallet badge can persist into
 * the login screen.
 */
export function useSignOut() {
  const { disconnectAsync } = useDisconnect();

  return useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      // A wallet that refuses to disconnect must not trap someone in a
      // session they are trying to leave. Dropping the token below is the
      // part that actually signs them out.
    }

    const { clearAuthToken } = await import("@/lib/api");
    clearAuthToken();

    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }, [disconnectAsync]);
}
