/**
 * Browser Notification helpers for live spectator events. Pure browser
 * APIs — no service worker, no VAPID server. Notifications fire only
 * when the document is hidden so we don't double-notify a user who's
 * already staring at the SpectatorView.
 */

export type LiveNotificationKind = 'throw' | 'elimination' | 'victory';

/**
 * Request notification permission from the browser. Safe to call even
 * when notifications aren't supported — returns 'denied' silently.
 */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'denied'
> {
  if (typeof window === 'undefined') return 'denied';
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

interface NotifyOptions {
  title: string;
  body: string;
  tag?: string;
  /** Always fire even when the tab is visible. Default: only when hidden. */
  forceShow?: boolean;
}

/**
 * Fire a browser notification if permission was granted and the user
 * isn't currently looking at the page. The `tag` field replaces any
 * previous notification with the same tag — used to keep the
 * notification tray clean (one entry per live match).
 */
export function notifyLiveEvent({
  title,
  body,
  tag,
  forceShow = false,
}: NotifyOptions): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!forceShow && document.visibilityState === 'visible') return;
  try {
    new Notification(title, {
      body,
      tag: tag ?? 'mister-molkky-live',
      icon: `${import.meta.env.BASE_URL || '/'}icons/icon-192.png`,
      silent: false,
    });
  } catch {
    /* ignore — some browsers throw under restricted contexts */
  }
}
