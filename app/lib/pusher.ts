import Pusher from 'pusher';

export interface PusherCreds {
  app_id: string;
  key: string;
  secret: string;
  cluster: string;
}

interface WorkspacePusherFields {
  pusher_app_id?: string | null;
  pusher_key?: string | null;
  pusher_secret?: string | null;
  pusher_cluster?: string | null;
}

/**
 * Central Pusher app shared by every workspace (managed realtime). Returns the
 * creds only when all four env vars are present, otherwise null so callers can
 * fall back to a workspace's own keys.
 */
export function centralPusherCreds(): PusherCreds | null {
  const app_id = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (app_id && key && secret && cluster) return { app_id, key, secret, cluster };
  return null;
}

function workspaceCreds(ws: WorkspacePusherFields): PusherCreds | null {
  if (ws.pusher_app_id && ws.pusher_key && ws.pusher_secret && ws.pusher_cluster) {
    return {
      app_id: ws.pusher_app_id,
      key: ws.pusher_key,
      secret: ws.pusher_secret,
      cluster: ws.pusher_cluster,
    };
  }
  return null;
}

/**
 * Server-side creds for triggering events. Central app wins so customers don't
 * have to configure anything; a workspace's own keys are the fallback.
 */
export function resolvePusherServer(ws: WorkspacePusherFields): PusherCreds | null {
  return centralPusherCreds() ?? workspaceCreds(ws);
}

/**
 * The key + cluster the browser/extension subscribes with. Must resolve the
 * same way as the server so both ends talk to the same Pusher app.
 */
export function resolvePusherClient(ws: WorkspacePusherFields): {
  key: string | null;
  cluster: string | null;
} {
  const creds = resolvePusherServer(ws);
  return { key: creds?.key ?? null, cluster: creds?.cluster ?? null };
}

export function makePusher(c: PusherCreds): Pusher {
  return new Pusher({
    appId: c.app_id,
    key: c.key,
    secret: c.secret,
    cluster: c.cluster,
    useTLS: true,
  });
}
