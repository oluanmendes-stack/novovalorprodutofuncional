import { RequestHandler } from "express";
import * as fs from "fs";
import * as path from "path";

/**
 * Get the images folder path (legacy - for backwards compatibility)
 * Looks for the "imagens" folder in public/catalogo directory
 * Returns the expected public image folder path
 */
export function getImagesFolderPath(): string {
  // Return the most likely path for compatibility
  return path.resolve(process.cwd(), "public/catalogo/imagens");
}

/**
 * Set the images folder path (legacy - kept for compatibility)
 */
export function setImagesFolderPath(folderPath: string) {
  console.log(`Note: Images folder path is auto-detected from project root`);
}

/**
 * Synchronously find images for a product code
 * NOTE: This method is now limited and currently returns an empty array.
 * Use the async findProductImages instead.
 */
export function findProductImagesSync(code: string): string[] {
  console.warn("[findProductImagesSync] Sync method no longer supported. Use async findProductImages instead.");
  return [];
}

/**
 * Find images for a product code
 * Generates static image URL candidates for the /catalogo/imagens folder.
 * In production, this does not depend on Supabase Storage.
 */
export const findProductImages: RequestHandler = (req, res) => {
  try {
    const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;

    if (!code || code.trim() === "") {
      res.status(400).json({
        success: false,
        error: "Product code is required",
      });
      return;
    }

    const codeLower = code.toLowerCase().trim();
    const codeUpper = code.toUpperCase();

    const basePatterns = [
      `${code}`,
      `${codeLower}`,
      `${codeUpper}`,
    ];

    const extensions = ['.jpg', '.jpeg', '.png'];
    const filenamePatterns: string[] = [];

    for (const basePattern of basePatterns) {
      filenamePatterns.push(basePattern);
      for (let i = 1; i <= 9; i++) {
        filenamePatterns.push(`${basePattern}-${i}`);
      }
      for (let i = 1; i <= 9; i++) {
        filenamePatterns.push(`${basePattern}(${i})`);
      }
    }

    const patternsWithExtensions: string[] = [];
    for (const pattern of filenamePatterns) {
      for (const ext of extensions) {
        patternsWithExtensions.push(`${pattern}${ext}`);
      }
    }

    const allPatterns = [...filenamePatterns, ...patternsWithExtensions];

    const brands = [
      "TECNOPRINT",
      "PHYSIO CONTROL",
      "MEDMAX",
      "MED-LINKET",
      "GABMED",
      "CONTEC",
    ];

    const images = new Set<string>();
    const addCandidateUrl = (folder: string | null, filename: string) => {
      const parts = [folder, filename].filter(Boolean).map(String);
      images.add(`/catalogo/imagens/${parts.join('/')}`);
    };

    for (const pattern of allPatterns) {
      addCandidateUrl(null, pattern);
    }

    for (const brand of brands) {
      for (const pattern of allPatterns) {
        addCandidateUrl(brand, pattern);
      }
    }

    const imageUrls = Array.from(images);

    res.json({
      success: true,
      data: imageUrls,
      count: imageUrls.length,
      message: imageUrls.length > 0
        ? `Generated ${imageUrls.length} image URL candidates for product code: ${code}`
        : `No image URL candidates could be generated for product code: ${code}`,
    });
  } catch (error) {
    console.error("Error finding product images:", error);
    res.status(500).json({
      success: false,
      error: "Failed to find product images",
    });
  }
};

/**
 * Get a specific image file
 * Returns the image file as a response
 * Can also open the file on Windows systems using the openImage route
 */
export const getImageFile: RequestHandler = async (req, res) => {
  try {
    const { imagePath } = req.query;

    if (!imagePath || typeof imagePath !== "string") {
      res.status(400).json({
        success: false,
        error: "Image path is required",
      });
      return;
    }

    // Verify the file exists and is within the images folder
    const resolvedPath = path.resolve(imagePath);
    const resolvedImageFolder = path.resolve(getImagesFolderPath());

    if (!resolvedPath.startsWith(resolvedImageFolder)) {
      console.warn(`[getImageFile] Access denied: path outside folder - ${imagePath}`);
      res.status(403).json({
        success: false,
        error: "Access denied: Image path outside configured folder",
      });
      return;
    }

    // Try to serve from local filesystem first
    if (fs.existsSync(resolvedPath)) {
      const buffer = fs.readFileSync(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
      return;
    }

    // Fallback to GitHub
    const fileResolver = await import("../utils/file-resolver");
    const gitHubPath = resolvedPath.replace(/\\/g, "/").replace(process.cwd(), "").replace(/^\//, "");
    const buffer = await fileResolver.resolveFilePath(resolvedPath, gitHubPath, { logNotFound: false });

    if (buffer) {
      // Set appropriate content type based on file extension
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
      };
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
      return;
    }

    res.status(404).json({
      success: false,
      error: "Image file not found",
    });
  } catch (error) {
    console.error("Error retrieving image file:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve image file",
    });
  }
};

/**
 * Open an image file (Windows only)
 * Equivalent to Python's os.startfile(img)
 * This opens the image with the system's default image viewer
 */
export const openImage: RequestHandler = (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath || typeof imagePath !== "string") {
      res.status(400).json({
        success: false,
        error: "Image path is required",
      });
      return;
    }

    // Verify the file exists and is within the images folder
    const resolvedPath = path.resolve(imagePath);
    const resolvedImageFolder = path.resolve(getImagesFolderPath());

    if (!resolvedPath.startsWith(resolvedImageFolder)) {
      res.status(403).json({
        success: false,
        error: "Access denied: Image path outside configured folder",
      });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({
        success: false,
        error: "Image file not found",
      });
      return;
    }

    // Try to open with system default viewer
    // This is platform-dependent:
    // - Windows: os.startfile()
    // - macOS: open command
    // - Linux: xdg-open command
    const { exec } = require("child_process");

    let command = "";
    if (process.platform === "win32") {
      command = `start "" "${resolvedPath}"`;
    } else if (process.platform === "darwin") {
      command = `open "${resolvedPath}"`;
    } else {
      command = `xdg-open "${resolvedPath}"`;
    }

    exec(command, (error: any) => {
      if (error) {
        console.error("Error opening image:", error);
        res.status(500).json({
          success: false,
          error: "Failed to open image",
        });
        return;
      }

      res.json({
        success: true,
        message: "Image opened successfully",
      });
    });
  } catch (error) {
    console.error("Error opening image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to open image",
    });
  }
};
