import express, { type Request, type Response, type NextFunction, type Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function createAppAndServer(): Promise<{ app: Express; httpServer: Server }> {
  const app: Express = express();
  const httpServer: Server = createServer(app);

  // Browser SPA on another origin (e.g. Vercel) calling this API — set CORS_ORIGIN to that site.
  const corsOrigin = process.env.CORS_ORIGIN?.trim() || "*";
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  // Log API calls (keep lightweight in production).
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;
      const duration = Date.now() - start;
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  return { app, httpServer };
}

export async function createApp(): Promise<Express> {
  const { app } = await createAppAndServer();
  return app;
}

