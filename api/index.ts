import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return (app as any)(req, res);
}

