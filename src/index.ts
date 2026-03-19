import { createServer } from "node:http";
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

  const httpServer = createServer(async (req, res) => {
    try {
      getContext(req.headers);
      await transport.handleRequest(req, res);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        res.statusCode = error.statusCode;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Internal server error" }));
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
