import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export async function GET(context: APIContext) {
	const blog = await getSortedPosts();

	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site: context.site ?? "https://fuwari.vercel.app",
		// 只放摘要，不放全文：原来把整篇正文塞进 <content:encoded>，
		// 爬虫抓一个 rss.xml 就能把所有文章端走，连翻页都省了。
		items: blog.map((post) => ({
			title: stripInvalidXmlChars(post.data.title),
			pubDate: post.data.published,
			description: stripInvalidXmlChars(post.data.description || ""),
			link: url(`/posts/${post.slug}/`),
		})),
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
