import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "yamap-mcp-for-lineai",
  version: "1.0.0",
});

// Register tools

// Tool: playwright_test
server.registerTool(
  "playwright_test",
  {
    description: "Accesses a URL using Playwright Chromium and returns the full rendered HTML",
    inputSchema: {
      url: z.url().describe("The URL to access"),
    },
  },
  async ({ url }) => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: "networkidle" });

    const content = await page.content();

    await browser.close();

    return {
      content: [
        {
          type: "text" as const,
          text: content,
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("YAMAP MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
