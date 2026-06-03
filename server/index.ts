import "dotenv/config";

import cors from "cors";
import express from "express";
import path from "node:path";
import { createRequire } from "node:module";

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

const app = express();

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

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve(UPLOADS_DIR)));

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Marvelle API is running successfully." });
});

app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/shades", shadeRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && String(err.message || "").startsWith("CORS:")) {
    return res.status(403).json({ error: err.message });
  }

  return errorHandler(err, req, res, next);
});

app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

const start = async () => {
  await ensureUploadsDir();

  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 3001);

  app.listen(port, () => {
    console.log(`Marvelle API ready on http://localhost:${port}`);
  });
};

void start().catch((error) => {
  console.error("Failed to start Marvelle API", error);
  process.exit(1);
});
