import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "yuanmuyan",
	subtitle: "Little Steps of Growth",
	lang: "zh_CN",
	themeColor: {
		hue: 130,
		fixed: false,
	},
	banner: {
		enable: false,
		 src: "assets/images/firefly.png",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{ name: "友链", url: "/friends/", external: false },
		{ name: "WP", url: "/wp/", external: false },
		{
			name: "GitHub",
			url: "https://github.com/yuanmuyan",
			external: true,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.png",
	name: "yuanmuyan",
	bio: "web手一枚~，欢迎各位师傅的参观~",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/yuanmuyan",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};