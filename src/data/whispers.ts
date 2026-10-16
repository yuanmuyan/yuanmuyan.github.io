export type WhisperRarity = "普通" | "稀有" | "传说";

export interface Whisper {
	id: string;
	text: string;
	rarity: WhisperRarity;
}

/**
 * 悄悄话内容池：想加句子只改这个文件就行。
 * 注意 id 一旦被抽到过就不要改（改了就认不出收集记录，等于给访客多送一条）。
 */
export const whispers: Whisper[] = [
	{
		id: "w1",
		text: "唔……被你发现了，这里其实只有我一个人常来",
		rarity: "普通",
	},
	{
		id: "w2",
		text: "写不出东西？要不要~我推荐你几位大手子",
		rarity: "普通",
	},
	{
		id: "w3",
		text: "天青色等烟雨，而我在等你~",
		rarity: "普通",
	},
	{
		id: "w4",
		text: "别急着走嘛，再翻翻，说不定下一篇正好是你需要的",
		rarity: "普通",
	},
	{
		id: "w5",
		text: "今天也要记得喝水，不然小鲸鲸会担心的（来自小鲸鲸的特别关心）",
		rarity: "普通",
	},
	{
		id: "w6",
		text: "不必如此匆忙，我在这里等你~",
		rarity: "普通",
	},
	{
		id: "w7",
		text: "哎呀呀被你抽到了呢，最近要是遇到了难题，说不定可以灵光一闪呢~",
		rarity: "稀有",
	},
	{
		id: "w8",
		text: "偷偷告诉你：背景里那些萤火虫，是我从别人的夜空里借来的",
		rarity: "稀有",
	},
	{
		id: "w9",
		text: "这个站里的每一行 CSS，都是我被骂过之后才改对的",
		rarity: "稀有",
	},
	{
		id: "w10",
		text: "你也有单曲循环的歌吗，要不要~猜猜我的是什么~",
		rarity: "稀有",
	},
	{
		id: "w11",
		text: "能抽到这个证明你今天运势拉满，说不定~十连满命~",
		rarity: "传说",
	},
	{
		id: "w12",
		text: "该死的报错！！可恶的兼容！！到底哪里有问题！！！唉，希望你不要被报错糊脸——",
		rarity: "传说",
	},
	{
		id: "w13",
		text: "想我了记得回来看看我呀~",
		rarity: "传说",
	},
];

/** 各稀有度的权重：越大越常见 */
export const whisperRarityWeight: Record<WhisperRarity, number> = {
	普通: 60,
	稀有: 30,
	传说: 10,
};

/** 每天能抽几次（想改成不限次就写个很大的数） */
export const whisperDailyLimit = 1;
