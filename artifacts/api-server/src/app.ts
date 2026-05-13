import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import path from "path";
import fs from "fs";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

const PgSession = connectPgSimple(session);
export const pgPool = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

const sessionStore = new PgSession({
  pool: pgPool,
  tableName: "user_sessions",
  createTableIfMissing: true,
});

sessionStore.on("error", (err) => {
  logger.error({ err }, "Session store error");
});

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser(process.env["SESSION_SECRET"] ?? "rizz-secret-2024"));
app.use(
  session({
    store: sessionStore,
    secret: process.env["SESSION_SECRET"] ?? "rizz-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
      sameSite: "none",
    },
  }),
);

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const uploadsDir = path.resolve("./uploads");
app.use("/api/uploads", express.static(uploadsDir));

app.use("/api", router);

if (process.env["NODE_ENV"] === "production") {
  const frontendDist = path.resolve("./artifacts/nexus/dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  } else {
    logger.warn({ frontendDist }, "Frontend dist not found — skipping static serving");
  }
}

export default app;