import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import notFound from "./middleware/notFound";
import { node_env } from "./config/config";
import { indexRoutes } from "./routes/indexRoutes";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(express.static("public"));

// Morgan solo en node_env = "dev"
if (node_env === "development") {
    app.use(morgan('dev'));
}

// Rutas
app.use("/api", indexRoutes);

// Not Found
app.use(notFound);

export default app