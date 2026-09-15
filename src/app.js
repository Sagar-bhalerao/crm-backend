import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { apiV1 } from "./routes/index.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
if (!env.isProduction) app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ success: true, message: "API is running", data: { env: env.nodeEnv } }));

// API version lives in the URL from day one, so a v2 can be added later
// without breaking anything already calling v1.
app.use("/api/v1", apiV1);

app.use(notFoundHandler);
app.use(errorHandler);
