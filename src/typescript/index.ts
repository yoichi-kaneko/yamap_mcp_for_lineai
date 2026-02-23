import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as cheerio from "cheerio";
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

    const html = await page.content();

    await browser.close();

    const $ = cheerio.load(html);
    const lines: string[] = [];

    // 概要テーブルからデータを取得
    lines.push("概要");

    $(".Plan__Table .Plan__Table__Tr").each((_, row) => {
      const title = $(row).find(".Plan__Table__Title").text().trim();
      const text = $(row).find(".Plan__Table__Text").text().trim();
      if (title) {
        lines.push(`${title}: ${text}`);
      }
    });

    // 計画データやコース定数などからデータを取得
    lines.push("計画データ");

    $(".Plan__ActivityRecord__Item").each((_, item) => {
      const label = $(item).find(".Plan__ActivityRecord__Label").text().trim();
      const score = $(item).find(".Plan__ActivityRecord__Score").text().trim();
      if (label) {
        lines.push(`${label}: ${score}`);
      }
    });

    const courseHeading = $(".CourseConstant__Heading").text().trim();
    const courseDifficulty = $(".CourseConstant__DifficultyLevel").text().trim();
    const courseValue = $(".CourseConstant__Value").text().trim();
    if (courseHeading) {
      lines.push(`${courseHeading}: ${courseValue} (${courseDifficulty})`);
    }

    const paceHeading = $(".PaceMultiplier__Heading").text().trim();
    const paceLabel = $(".PaceMultiplier__Rate__Label").text().trim();
    const paceValue = $(".PaceMultiplier__Rate__Value__Number").text().trim();
    if (paceHeading) {
      lines.push(`${paceHeading}: ${paceValue}% (${paceLabel})`);
    }

    // 移動計画からデータを取得
    lines.push("移動計画");

    $(".CheckPoints div").each((_, item) => {
      const date = $(item).find(".CheckPoints__Heading").text().trim();
      const sunriseSunset = $(item).find(".CheckPoints__SunriseSunset").text().trim();
      const checkPoints = $(item).find(".CheckPoints__Item").map((_, point) => {
        const time = $(point).find(".CheckPoints__Item__Time").text().trim();
        const name = $(point).find(".CheckPoints__Item__Name").text().trim();
        const lodging = $(point).find(".CheckPoints__Item__Lodging").text().trim();
        return `${time} ${name} ${lodging}`;
      }).get().join("\n");
      lines.push(`${date}: ${sunriseSunset}\n${checkPoints}`);
    });

    return {
      content: [
        {
          type: "text" as const,
          text: lines.join("\n"),
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
