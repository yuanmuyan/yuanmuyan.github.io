import type { APIRoute } from "astro";

// 不想让它们拿去训练 / 做 AI 索引的爬虫（robots.txt 是君子协定，守规矩的会照做）
// 这里只列"抓来训练 / 建索引"的，故意不含 ChatGPT-User、Claude-User 这类"用户当场要我读一下网页"的
const aiCrawlers = [
	"GPTBot",
	"OAI-SearchBot",
	"CCBot",
	"ClaudeBot",
	"anthropic-ai",
	"Google-Extended",
	"Bytespider",
	"Amazonbot",
	"PerplexityBot",
	"Applebot-Extended",
	"meta-externalagent",
	"FacebookBot",
	"Diffbot",
	"Omgilibot",
	"ImagesiftBot",
	"cohere-ai",
	"YouBot",
	"Timpibot",
];

const aiBlocks = aiCrawlers
	.map((bot) => `User-agent: ${bot}\nDisallow: /`)
	.join("\n\n");

const robotsTxt = `
User-agent: *
Disallow: /_astro/

${aiBlocks}

Sitemap: ${new URL("sitemap-index.xml", import.meta.env.SITE).href}
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
