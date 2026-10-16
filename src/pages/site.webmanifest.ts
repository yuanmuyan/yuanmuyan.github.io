import type { APIRoute } from "astro";
import { siteConfig } from "@/config";

// 手机端（尤其"添加到主屏 / 收藏"）认的是 apple-touch-icon 与这份 manifest，
// 只给 <link rel="icon"> 的话，iOS 主屏和部分安卓启动器会退回一个通用小图标。
export const GET: APIRoute = () => {
	const manifest = {
		name: `${siteConfig.title}${siteConfig.subtitle ? ` - ${siteConfig.subtitle}` : ""}`,
		short_name: siteConfig.title,
		description: siteConfig.subtitle || "",
		start_url: "/",
		display: "standalone",
		background_color: "#0f2b28",
		theme_color: "#9fdfd0",
		icons: [
			{ src: "/favicon/avatar-128.png", sizes: "128x128", type: "image/png" },
			{ src: "/favicon/avatar-180.png", sizes: "180x180", type: "image/png" },
			{ src: "/favicon/avatar-192.png", sizes: "192x192", type: "image/png" },
		],
	};

	return new Response(JSON.stringify(manifest, null, 2), {
		headers: {
			"Content-Type": "application/manifest+json",
		},
	});
};
