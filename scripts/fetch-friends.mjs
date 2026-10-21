// 抓取友链站点的最新文章，生成 src/data/friends-feed.json 供「朋友圈」页面使用。
// 设计原则：永远不因为某个站挂掉而中断构建 —— 单个站失败就沿用上一次的缓存内容。
// 由 `pnpm build` 自动调用（见 package.json），也可单独 `node scripts/fetch-friends.mjs`。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sitesFile = path.join(root, "src", "data", "friends.json");
const outArg = process.argv.indexOf("--out");
const outFile =
	outArg > 0 && process.argv[outArg + 1]
		? path.resolve(process.argv[outArg + 1])
		: path.join(root, "src", "data", "friends-feed.json");

const MAX_ITEMS_PER_SITE = 6;
const TIMEOUT_MS = 20000;

const decodeEntities = (s) =>
	s
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&amp;/g, "&");

const stripCdata = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();

const stripTags = (s) =>
	decodeEntities(stripCdata(s))
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const excerptOf = (html, limit = 110) => {
	const text = stripTags(html);
	if (text.length <= limit) return text;
	return `${text.slice(0, limit).trim()}…`;
};

const pick = (block, tags) => {
	for (const tag of tags) {
		const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
		const m = block.match(re);
		if (m?.[1]?.trim()) return m[1];
	}
	return "";
};

const linkOf = (block) => {
	const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
	if (alt) return alt[1];
	const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
	if (href) return href[1];
	const plain = block.match(/<link>([\s\S]*?)<\/link>/i);
	if (plain?.[1]) return stripCdata(plain[1]).trim();
	return "";
};

const parseFeed = (xml) => {
	const blocks = [
		...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
		...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
	].map((m) => m[0]);

	const items = [];
	for (const block of blocks) {
		const title = stripTags(pick(block, ["title"]));
		const link = linkOf(block);
		const rawDate =
			pick(block, ["pubDate", "published", "updated", "dc:date", "date"]) || "";
		const summarySource =
			pick(block, ["summary", "description"]) ||
			pick(block, ["content:encoded", "content"]);
		if (!title || !/^https?:\/\//i.test(link)) continue;
		const time = new Date(stripTags(rawDate));
		items.push({
			title,
			link,
			date: Number.isNaN(time.valueOf()) ? null : time.toISOString(),
			excerpt: excerptOf(summarySource),
		});
	}
	return items;
};

const fetchFeed = async (urls) => {
	for (const url of urls) {
		try {
			const res = await fetch(url, {
				redirect: "follow",
				headers: { "user-agent": "yuanmuyan-blog-friends-feed/1.0" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!res.ok) continue;
			const xml = await res.text();
			if (!/<rss|<feed|<rdf:RDF/i.test(xml.slice(0, 2000))) continue;
			const items = parseFeed(xml);
			if (items.length > 0) return items;
		} catch (err) {
			console.warn(`[friends-feed] 抓取失败 ${url}: ${err?.message ?? err}`);
		}
	}
	return null;
};

const readJson = (file, fallback) => {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return fallback;
	}
};

const main = async () => {
	const { sites } = readJson(sitesFile, { sites: [] });
	const previous = readJson(outFile, { sites: [] });
	const prevByUrl = new Map((previous.sites ?? []).map((s) => [s.url, s]));

	const results = [];
	let fetched = 0;

	for (const site of sites) {
		const feeds = site.feeds ?? [];
		let items = feeds.length > 0 ? await fetchFeed(feeds) : null;
		if (items) {
			fetched += 1;
			items = items
				.sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
				.slice(0, MAX_ITEMS_PER_SITE);
		} else {
			const cached = prevByUrl.get(site.url);
			items = Array.isArray(cached?.items) ? cached.items : [];
		}
		results.push({
			name: site.name,
			desc: site.desc,
			url: site.url,
			avatar: site.avatar,
			hasFeed: feeds.length > 0,
			items,
		});
	}

	const output = {
		generatedAt: new Date().toISOString(),
		sites: results,
	};

	// 内容没变就不重写文件：不然每次本地构建都会把 generatedAt 改一遍，git 一直脏
	const unchanged =
		JSON.stringify(previous.sites ?? []) === JSON.stringify(results);
	if (unchanged && fs.existsSync(outFile)) {
		console.log(
			`[friends-feed] ${fetched}/${sites.length} 个站点抓取成功，内容无变化，跳过写入`,
		);
		return;
	}

	fs.writeFileSync(outFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	console.log(
		`[friends-feed] ${fetched}/${sites.length} 个站点抓取成功，共 ${results.reduce((n, s) => n + s.items.length, 0)} 条动态`,
	);
};

main().catch((err) => {
	// 构建不能被这个脚本拖死
	console.warn(`[friends-feed] 跳过：${err?.message ?? err}`);
});
