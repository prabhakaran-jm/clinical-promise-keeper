import { createServer, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { ForbiddenError, getContext } from "./sharp/context.js";

const port = Number(process.env.PORT ?? "3000");

async function start(): Promise<void> {
  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await mcpServer.connect(transport);

  const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(payload));
  };

  const httpServer = createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const path = req.url ? new URL(req.url, "http://localhost").pathname : "/";

    try {
      if (method === "GET" && path === "/health") {
        sendJson(res, 200, {
          status: "ok",
          name: "clinical-promise-keeper",
          version: "0.1.0",
        });
        return;
      }

      if (path === "/mcp" && (method === "GET" || method === "POST" || method === "DELETE")) {
        getContext(req.headers);
        await transport.handleRequest(req, res);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }

      sendJson(res, 500, { error: "Internal server error" });
    }
  });

  httpServer.listen(port, () => {
    console.log(`clinical-promise-keeper listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
