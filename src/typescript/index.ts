import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "yamap-mcp-for-lineai",
  version: "1.0.0",
});

// ツールの登録

// URLの正規化処理
// 受け付けるフォーマット:
//   - https://yamap.com/plans/code/{CODE}
//   - https://yamap.com/plans/code/{CODE}/printing -> 末尾の /printing を除去して使用
// それ以外のURLはエラーとして扱う
function normalizeYamapUrl(url: string): string {
  const exactPattern = /^https:\/\/yamap\.com\/plans\/code\/[^/]+$/;
  const printingPattern = /^https:\/\/yamap\.com\/plans\/code\/[^/]+(\/printing)$/;

  if (exactPattern.test(url)) {
    return url;
  }

  const printingMatch = url.match(printingPattern);
  if (printingMatch) {
    // 末尾の /printing を除去
    return url.slice(0, url.length - printingMatch[1].length);
  }

  throw new Error(
    `URLのフォーマットが正しくありません。\n` +
    `受け付けるフォーマット:\n` +
    `  - https://yamap.com/plans/code/{CODE}\n` +
    `  - https://yamap.com/plans/code/{CODE}/printing\n` +
    `指定されたURL: ${url}`,
  );
}

// ツール: fetch_yamap_plan_page
server.registerTool(
  "fetch_yamap_plan_page",
  {
    description: "YAMAPの山行計画ページのURLを受け取り、Playwright Chromiumでアクセスしてレンダリング済みのHTMLを返します",
    inputSchema: {
      url: z.url().describe("YAMAPの山行計画ページのURL"),
    },
  },
  async ({ url }) => {
    // URLの検証と正規化
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeYamapUrl(url);
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(normalizedUrl, { waitUntil: "networkidle" });

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
