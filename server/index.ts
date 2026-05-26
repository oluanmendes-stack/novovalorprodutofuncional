// Conditional dotenv import for local development only
if (process.env.NODE_ENV !== "production") {
  import("dotenv/config").catch(() => {});
}
import express from "express";
import cors from "cors";
import * as path from "path";
import * as fs from "fs";
import { getD1, isCloudflareD1Available } from "./lib/d1-client";
import { handleDemo } from "./routes/demo";
import {
  getProducts,
  searchProductsHandler,
  getProductByCodeHandler,
  importProductsHandler,
  deleteAllProductsHandler,
} from "./routes/d1-products";
import { importFromCSV } from "./routes/csv-import";
import { getConfig, saveConfig, validateConfig } from "./routes/config";
import {
  generateBatchReport,
  exportBatchPDF,
  exportBatchExcel,
} from "./routes/batch";
import {
  findProductImages,
  getImageFile,
  openImage,
  getImagesFolderPath,
} from "./routes/images";
import { proxyGoogleDriveImage } from "./routes/google-drive-proxy";
import {
  getDescriptor,
  getAnvisaRegistration,
  getMultipleDescriptors,
} from "./routes/descriptors";
import { findCatalogPath, getCatalogFile } from "./routes/catalogs";
import { extractPDFData } from "./routes/pdf";
import {
  getProductDebug,
  getAllProductsDebug,
  searchProductsDebug,
} from "./routes/debug";
import {
  getCompatibility,
  searchCompatibility,
  createCompatibility,
  updateCompatibility,
  deleteCompatibility,
  importCompatibility,
} from "./routes/compatibility";

// Empty array for backwards compatibility with other routes
// Products are now loaded from the local D1 database or Cloudflare D1 binding
export const priceData: any[] = [];

export async function createServer() {
  console.log(`\n[Server] Process working directory: ${process.cwd()}`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`[Server] VITE_GOOGLE_DRIVE_API_KEY is set: ${!!process.env.VITE_GOOGLE_DRIVE_API_KEY}`);
  console.log(`[Server] VITE_GOOGLE_DRIVE_FOLDER_ID is set: ${!!process.env.VITE_GOOGLE_DRIVE_FOLDER_ID}`);

  try {
    if (isCloudflareD1Available()) {
      console.log(`[Server] Running with Cloudflare D1 binding.`);
    } else {
      getD1();
      console.log(`[Server] Local SQLite fallback initialized for D1.`);
    }
  } catch (error) {
    console.error(`[Server] Failed to initialize D1:`, error);
  }

  const app = express();

  // Basic health check
  app.get("/api/ping", (req, res) => {
    res.json({ 
      success: true, 
      status: "alive", 
      time: new Date().toISOString(),
      d1_binding: isCloudflareD1Available(),
      env_keys: Object.keys(process.env).filter(k => k === "NODE_ENV")
    });
  });

  // Middleware
  app.use(cors());

  // Path normalization for Netlify Functions
  app.use((req, res, next) => {
    const originalUrl = req.url;
    // Strip Netlify function prefix if present
    if (req.url.startsWith("/.netlify/functions/api")) {
      req.url = req.url.replace("/.netlify/functions/api", "");
      if (req.url === "") req.url = "/";
      console.log(`[Path Normalization] ${originalUrl} -> ${req.url}`);
    }
    
    // Ensure we log API requests
    if (req.path.startsWith("/api/") || req.path === "/api" || req.path === "/") {
       console.log(`[API Request] ${req.method} ${req.path} (Original: ${originalUrl})`);
    }
    next();
  });

  // Increase payload size limit for large CSV imports (default is 100kb)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const apiRouter = express.Router();

  // Diagnostic route
  apiRouter.get("/diag", (req, res) => {
    res.json({
      success: true,
      message: "Server is online",
      cwd: process.cwd(),
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      headers: {
        host: req.headers.host,
        "x-forwarded-for": req.headers["x-forwarded-for"]
      },
      env: {
        D1_BINDING: !!isCloudflareD1Available(),
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        GOOGLE_DRIVE_API_KEY: !!process.env.VITE_GOOGLE_DRIVE_API_KEY || !!process.env.GOOGLE_DRIVE_API_KEY,
        GOOGLE_DRIVE_FOLDER_ID: !!process.env.VITE_GOOGLE_DRIVE_FOLDER_ID || !!process.env.GOOGLE_DRIVE_FOLDER_ID,
      },
      timestamp: new Date().toISOString()
    });
  });

  // Health check
  apiRouter.get("/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping });
  });



  apiRouter.get("/demo", handleDemo);

  // ===== DEBUG API =====
  apiRouter.get("/debug/product", getProductDebug);
  apiRouter.get("/debug/all-products", getAllProductsDebug);
  apiRouter.get("/debug/search", searchProductsDebug);

  // ===== PRODUCTS API (from D1) =====
  apiRouter.get("/products", getProducts);
  apiRouter.get("/products/search", searchProductsHandler);
  apiRouter.post("/products/import", importProductsHandler);
  apiRouter.post("/products/import-csv", importFromCSV);
  apiRouter.delete("/products/delete-all", deleteAllProductsHandler);
  apiRouter.get("/products/:code", getProductByCodeHandler);

  // ===== CONFIGURATION API =====
  apiRouter.get("/config", getConfig);
  apiRouter.post("/config/save", saveConfig);
  apiRouter.post("/config/validate", validateConfig);

  // ===== BATCH/LOTE API =====
  apiRouter.post("/batch/report", generateBatchReport);
  apiRouter.post("/batch/export/pdf", exportBatchPDF);
  apiRouter.post("/batch/export/excel", exportBatchExcel);

  // ===== DESCRIPTORS API =====
  apiRouter.get("/descriptors/:code", getDescriptor);
  apiRouter.get("/descriptors/:code/anvisa", getAnvisaRegistration);
  apiRouter.post("/descriptors/multiple", getMultipleDescriptors);

  // ===== CATALOGS API =====
  apiRouter.get("/catalogo/file", getCatalogFile);
  apiRouter.get("/catalogo/:code", findCatalogPath);

  // ===== PDF EXTRACTION API =====
  apiRouter.get("/pdf/extract", extractPDFData);

  // ===== IMAGES API =====
  apiRouter.get("/images/file", getImageFile);
  apiRouter.post("/images/open", openImage);
  apiRouter.get("/images/:code", findProductImages);

  // ===== GOOGLE DRIVE PROXY API =====
  apiRouter.get("/proxy-google-image", proxyGoogleDriveImage);

  // Apply the router to both /api and root /
  // This ensures compatibility with both Netlify redirects and local development
  app.use("/api", apiRouter);
  app.use("/", apiRouter);

  // Images API initialized message (wrapped in try-catch for Cloudflare compatibility)
  try {
    const imagePath = getImagesFolderPath();
    console.log(`[Images] API initialized. Detected folder: ${imagePath}`);
    console.log(`[Images] Folder exists: ${fs.existsSync(imagePath)}`);
  } catch (error) {
    console.log("[Images] Local filesystem not available (running in serverless/edge environment)");
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[ERROR] Unhandled error:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  });

  return app;
}
