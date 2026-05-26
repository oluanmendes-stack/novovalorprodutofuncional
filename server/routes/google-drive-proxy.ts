import { RequestHandler } from "express";

/**
 * Proxy images from Google Drive
 *
 * Fetches image content from Google Drive and returns it directly to the client,
 * bypassing CORS restrictions that prevent direct browser access to Google Drive links.
 *
 * Usage: /api/proxy-google-image?url=<encoded_url>
 */
export const proxyGoogleDriveImage: RequestHandler = async (req, res) => {
  let errorOccurred = false;

  try {
    const { url } = req.query;

    // Validate URL parameter
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    // Validate it's a Google Drive URL
    if (
      !url.includes("drive.google.com") &&
      !url.includes("googleapis.com")
    ) {
      return res.status(400).json({ error: "Only Google Drive URLs are allowed" });
    }

    console.log(`[GoogleDriveProxy] Processing: ${url.substring(0, 100)}`);

    // Fetch directly from Google Drive
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      console.error(
        `[GoogleDriveProxy] Failed: ${response.status} ${response.statusText}`
      );

      if (response.status === 403) {
        return res.status(403).json({
          error: "File is private or not shared",
          message: "Arquivo é privado ou não compartilhado publicamente",
        });
      }

      if (response.status === 404) {
        return res.status(404).json({
          error: "File not found",
          message: "Arquivo não encontrado",
        });
      }

      return res.status(response.status).json({
        error: "Failed to fetch from Google Drive",
        status: response.status,
      });
    }

    // Get content type
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Set response headers
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send the image
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    errorOccurred = true;
    console.error("[GoogleDriveProxy] Exception caught:", error);

    // Only send response if not already sent
    if (!res.headersSent) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: "Failed to proxy image",
        message: msg,
      });
    }
  }

  if (errorOccurred) {
    console.log("[GoogleDriveProxy] Request completed with error");
  }
};
