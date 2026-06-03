import "dotenv/config";

import cors from "cors";
import express from "express";
import next from "next";
import path from "node:path";
import net from "node:net";
import { createRequire } from "node:module";

import { env } from "./config/env";
import { getAllowedOrigins, isAllowedOrigin } from "./config/cors";
import { ensureUploadsDir, UPLOADS_DIR } from "./config/upload";
import { errorHandler } from "./middleware/error";

const require = createRequire(import.meta.url);
const userRoutes = require("./routes/user.routes");
const productRoutes = require("./routes/product.routes");
const shadeRoutes = require("./routes/shade.routes");
const collectionRoutes = require("./routes/collection.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const uploadRoutes = require("./routes/upload.routes");
const reviewRoutes = require("./routes/review.routes");
const orderRoutes = require("./routes/order.routes");

const apiApp = express();

const corsOptions = {
  origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin) || getAllowedOrigins().includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS: Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

apiApp.use(cors(corsOptions));
apiApp.use(express.json({ limit: "1mb" }));
apiApp.use("/uploads", express.static(path.resolve(UPLOADS_DIR)));

apiApp.get("/", (_req, res) => {
  res.status(200).json({ message: "Marvelle API is running successfully." });
});

apiApp.use("/api/users", userRoutes);
apiApp.use("/api/products", productRoutes);
apiApp.use("/api/shades", shadeRoutes);
apiApp.use("/api/collections", collectionRoutes);
apiApp.use("/api/inventory", inventoryRoutes);
apiApp.use("/api/uploads", uploadRoutes);
apiApp.use("/api/reviews", reviewRoutes);
apiApp.use("/api/orders", orderRoutes);

apiApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && String(err.message || "").startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }

  return errorHandler(err, req, res, next);
});

apiApp.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const isPortAvailable = (port: number) =>
  new Promise<boolean>((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, "0.0.0.0");
  });

const findAvailablePort = async (preferredPort: number) => {
  let port = preferredPort;

  while (!(await isPortAvailable(port))) {
    port += 1;
  }

  return port;
};

const start = async () => {
  await ensureUploadsDir();

  const preferredPort = Number(process.env.PORT || env.port || 3000);
  const port = await findAvailablePort(preferredPort);
  const isDev = env.nodeEnv !== "production";

  const nextApp = next({
    dev: isDev,
    hostname: "localhost",
    port,
  });

  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  const server = express();
  server.use("/uploads", express.static(path.resolve(UPLOADS_DIR)));
  server.use((req, res, nextFn) => {
    if (req.url.startsWith("/api")) {
      return apiApp(req, res, nextFn);
    }

    return nextFn();
  });
  server.use((req, res) => handle(req, res));

  server.listen(port, () => {
    console.log(`Marvelle app ready on http://localhost:${port}`);
  });
};

void start().catch((error) => {
  console.error("Failed to start Marvelle app", error);
  process.exit(1);
});
