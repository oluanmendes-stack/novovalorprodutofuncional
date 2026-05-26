/// <reference types="@cloudflare/workers-types" />
import { createServer } from "../../server/index";

let app: any;

/**
 * Convert Cloudflare Request to Node.js-like request object
 */
async function createNodeRequest(cfRequest: Request, path: string, baseUrl: string) {
  const body = await cfRequest.text();

  return {
    method: cfRequest.method,
    url: path,
    headers: Object.fromEntries(cfRequest.headers),
    body: body,
    rawBody: body,
  };
}

/**
 * Mock Express request/response for Cloudflare Workers
 */
function createMockRequest(nodeReq: any) {
  const bodyBuffer = Buffer.from(nodeReq.body || '');

  return {
    method: nodeReq.method,
    url: nodeReq.url,
    path: nodeReq.url.split('?')[0],
    query: Object.fromEntries(new URLSearchParams(nodeReq.url.split('?')[1] || '')),
    headers: nodeReq.headers,
    body: nodeReq.body,
    rawBody: bodyBuffer,

    // Mock methods
    get: (key: string) => nodeReq.headers[key.toLowerCase()],
    on: () => {}, // No-op for stream events
  };
}

/**
 * Mock Express response for Cloudflare Workers
 */
function createMockResponse() {
  let statusCode = 200;
  let responseBody = '';
  const responseHeaders: any = { 'Content-Type': 'application/json' };

  return {
    statusCode,
    body: responseBody,
    headers: responseHeaders,

    status: (code: number) => {
      statusCode = code;
      return {
        json: (data: any) => {
          responseBody = JSON.stringify(data);
          responseHeaders['Content-Type'] = 'application/json';
          return { status: statusCode, body: responseBody, headers: responseHeaders };
        },
        send: (data: string) => {
          responseBody = data;
          return { status: statusCode, body: responseBody, headers: responseHeaders };
        },
      };
    },

    json: (data: any) => {
      responseBody = JSON.stringify(data);
      responseHeaders['Content-Type'] = 'application/json';
      return { status: statusCode, body: responseBody, headers: responseHeaders };
    },

    send: (data: string) => {
      responseBody = data;
      return { status: statusCode, body: responseBody, headers: responseHeaders };
    },

    set: (key: string, value: string) => {
      responseHeaders[key] = value;
      return this;
    },

    setHeader: (key: string, value: string) => {
      responseHeaders[key] = value;
    },

    end: function() {
      return { status: statusCode, body: responseBody, headers: responseHeaders };
    },
  };
}

/**
 * Catch-all handler for all /api/* routes on Cloudflare Pages
 */
export const onRequest: PagesFunction = async (context) => {
  try {
    // Store Cloudflare bindings
    if (context.env) {
      (globalThis as any).__CF_ENV = context.env;
      console.log("[Cloudflare] D1 binding available:", !!context.env.DB);
    }

    // Inject environment variables
    if (context.env) {
      Object.entries(context.env).forEach(([key, value]) => {
        if (typeof value === "string") {
          process.env[key] = value;
        }
      });
    }

    if (!app) {
      console.log("[Cloudflare] Initializing Express app...");
      app = await createServer();
      console.log("[Cloudflare] Express app initialized successfully");
    }

    // Extract path
    const url = new URL(context.request.url);
    const path = url.pathname + url.search;

    console.log(`[Cloudflare] ${context.request.method} ${path}`);

    // Create mock request/response
    const nodeReq = await createNodeRequest(context.request, path, url.origin);
    const req = createMockRequest(nodeReq);
    const res = createMockResponse() as any;

    // Route to Express
    return new Promise((resolve) => {
      // Set up response handler
      const originalJson = res.json;
      const originalStatus = res.status;

      res.json = function(data: any) {
        const result = originalJson.call(this, data);
        resolve(new Response(result.body, {
          status: result.status,
          headers: result.headers,
        }));
        return result;
      };

      res.status = function(code: number) {
        res.statusCode = code;
        const result = originalStatus.call(this, code);
        result.json = (data: any) => {
          const jsonResult = result.json(data);
          resolve(new Response(jsonResult.body, {
            status: jsonResult.status,
            headers: jsonResult.headers,
          }));
          return jsonResult;
        };
        return result;
      };

      // Handle Express routing
      app._router.handle(req, res, (err: any) => {
        if (err) {
          console.error("[Cloudflare] Routing error:", err);
          resolve(new Response(JSON.stringify({
            success: false,
            error: err.message || 'Internal server error',
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
      });

      // Timeout safety
      setTimeout(() => {
        resolve(new Response(JSON.stringify({
          success: false,
          error: 'Request timeout',
        }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        }));
      }, 29000);
    });
  } catch (error: any) {
    console.error("[Cloudflare] CRITICAL ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(JSON.stringify({
      success: false,
      error: `Cloudflare Function Error: ${errorMessage}`,
      details: error instanceof Error ? error.stack : String(error),
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
