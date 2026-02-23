import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create server instance
const server = new McpServer({
  name: "yamap-mcp-for-lineai",
  version: "1.0.0",
});

// Register tools

// Tool: hallo
server.registerTool(
  "hallo",
  {
    description: "Returns a hallo world message",
  },
  async () => {
    return {
      content: [
        {
          type: "text" as const,
          text: "hallo world",
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
