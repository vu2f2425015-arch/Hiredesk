import express, { Express, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { authRouter } from "./routes/auth.js";
import { bootstrapRouter } from "./routes/bootstrap.js";
import { adminRouter } from "./routes/admin.js";
import { jobsRouter } from "./routes/jobs.js";
import { applicationsRouter } from "./routes/applications.js";
import { inboundRouter } from "./routes/inbound.js";
import { analyticsRouter } from "./routes/analytics.js";
import { clientPortalRouter } from "./routes/clientPortal.js";
import { interviewsRouter } from "./routes/interviews.js";
import { talentPoolRouter } from "./routes/talentPool.js";
import { notificationsRouter } from "./routes/notifications.js";
import { aiRecruiterRouter } from "./routes/aiRecruiter.js";
import { sendError } from "./utils/response.js";

export function createApp(): Express {
  const app = express();

  // The API is deployed behind one trusted hosting proxy. This lets IP-based
  // rate limiters use the forwarded client address instead of the proxy IP.
  if (config.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Standard Security & Utility Middlewares
  app.use(helmet());
  // Explicit CORS allowlist validation
  const getAllowedOrigins = (): Set<string> => {
    const allowed = new Set<string>();
    if (config.CORS_ORIGIN) {
      config.CORS_ORIGIN.split(",")
        .map((o) => o.trim().replace(/\/+$/, ""))
        .filter(Boolean)
        .forEach((o) => allowed.add(o));
    }
    return allowed;
  };

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl, non-browser)
        if (!origin) return callback(null, true);

        try {
          const normalizedOrigin = origin.trim().replace(/\/+$/, "");
          const allowedOrigins = getAllowedOrigins();

          // 1. Explicitly configured origins are permitted
          if (allowedOrigins.has(normalizedOrigin)) {
            return callback(null, true);
          }

          // 2. In development and test environments, allow localhost / 127.0.0.1
          if (config.NODE_ENV !== "production") {
            const isLocalhost =
              /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
                normalizedOrigin,
              );
            if (isLocalhost) {
              return callback(null, true);
            }
          }

          // 3. Reject unconfigured origins in all environments (never allow wildcard *.vercel.app)
          const corsErr = new Error(
            `Origin '${origin}' not permitted by CORS policy`,
          );
          (corsErr as any).statusCode = 403;
          (corsErr as any).code = "CORS_ERROR";
          return callback(corsErr);
        } catch {
          const corsErr = new Error("Invalid Origin header");
          (corsErr as any).statusCode = 403;
          (corsErr as any).code = "CORS_ERROR";
          return callback(corsErr);
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(requestIdMiddleware);

  // Normalize accidental double /api/api prefix (e.g. from misconfigured frontend API_BASE)
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/api/")) {
      req.url = req.url.replace(/^\/api\/api\//, "/api/");
    }
    next();
  });

  // Cache Control Middleware: Protect multi-tenant isolation by marking private data as non-cacheable
  app.use((req, res, next) => {
    if (
      (req.path.startsWith("/career/") ||
        req.path.startsWith("/api/career/")) &&
      req.method === "GET"
    ) {
      res.setHeader(
        "Cache-Control",
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      );
    } else {
      res.setHeader(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });

  // Request Logging
  if (config.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) =>
          (req.headers["x-request-id"] as string) || randomUUID(),
      }),
    );
  }

  // Mount Routes
  app.use(healthRouter);
  app.use("/api", healthRouter);
  app.use("/api", authRouter);
  app.use("/api", meRouter);
  app.use("/api", bootstrapRouter);
  app.use("/api", adminRouter);
  app.use("/api", jobsRouter);
  app.use("/api", applicationsRouter);
  app.use("/api", inboundRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", clientPortalRouter);
  app.use("/api", interviewsRouter);
  app.use("/api/talent-pool", talentPoolRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/ai-recruiter", aiRecruiterRouter);

  // Fallthrough 404 handler
  app.use((req: Request, res: Response) => {
    sendError(res, "NOT_FOUND", `Cannot ${req.method} ${req.path}`, 404);
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
