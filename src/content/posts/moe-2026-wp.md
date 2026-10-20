---
title: 【2026moe】WP
published: 2026-10-20
description: moe才是我的第一站，虽然当时啥也不懂（现在也一样），就纯打着玩，要是感兴趣你可以看看？做这篇主要是纪念一下啦
tags: [WP, CTF, Web]
category: WP
draft: false
---

moe 算是我 CTF 的第一站。那时候连 F12 都不太会用，题目基本是靠瞎点碰出来的，做完也没有"复盘"这个概念，截图存了一堆就再没打开过。这次翻文件夹正好翻到，干脆挑三道印象最深的重做一遍，顺手记下来——与其说是 WP，不如说是给自己留个纪念。

> 📑 所有 WP 的总目录在 [WP 索引](/wp/)。

### 一、查分系统

这题是查期末成绩，页面上只有一个学号框和一个查询按钮。

正常操作只能查到自己那一条，所以我压根没想输学号，直接 F12 看它到底发了什么。结果 `<script>` 里不是初始化参数，而是整张成绩表：序号、学号、姓名、专业，还有一堆 `I-1-1`、`II-3-2` 这种小分，最后是总分和折合。

![图 1](/images/moe-2026/01.webp)

翻到第 47 条记录，`总分` 是 123，下面紧跟着的"折合"本该是个数字，却塞了一串字符串：

![图 2](/images/moe-2026/02.webp)

```
moectf{y0u_c@n_reAd_th3_h+nn1}
```

挺典型的"前端把背后整张表都发出来了"，前端能看见的东西约等于已经泄露。当时做出来还挺得意，现在回头看就是个数据下发过度，顺便后端对字段也没做类型校验。

### 二、古籍翻阅

站点是个古籍检索页，正常的书链接长这样：`/read?book=jing/chunqiu/index`。

Burp 抓首页，响应有十七万字节，我随手在响应里搜了个 `true`，翻到一条画风不太一样的：

![图 3](/images/moe-2026/03.webp)

```html
<a class="scroll-link" href="/read?book=true_file">
  <span class="seal">0737</span>
  <span class="title">无名真卷</span>
  <span class="meta">孤本</span>
```

点开只有一句话：

![图 4](/images/moe-2026/04.webp)

> 其实flag藏在了根目录下，去看看根目录吧

那就顺着往上爬：

![图 5](/images/moe-2026/05.webp)

```
/read?book=../../flag
```

```
moectf{re@d_the_r00t_5utr4_w1th_path_tr4v3r5@1}
```

`book` 参数被直接拼进文件路径，没做规范化。这题的乐趣其实在"发现"那一步——线索是埋在书列表里的一条孤本，得去翻响应源码才看得见。

### 三、七狗免费小说

三道题里我最喜欢这道。

站点叫「刻俄柏的小说」，三个链接：`chatp1.html`、`chap2.html`、`flag.php`。

![图 6](/images/moe-2026/06.webp)

直接 `?file=flag.php` 会**执行**它，但页面里藏了个 `display:none` 的 div，用 `highlight_file(__FILE__)` 把源码自己打出来了：

![图 7](/images/moe-2026/07.webp)

关键逻辑是这样：

```php
$file = $_GET['file'] ?? 'chap1.html';
if (preg_match('/http|https|env|\.\.|^\/|=\/|index|proc|input|data|convert|string|file/i', $file)) {
    die("咬你哦！");
}
ob_start();
include($file);
$output = ob_get_clean();
if (@preg_match('//u', $output)) {
    echo $output;
} else {
    /* 小刻不知道什么是二进制流 */
    echo base64_encode($output);
}
```

![图 8](/images/moe-2026/08.webp)

第一反应当然是 `convert.base64-encode`，然后喜提一句"咬你哦！"：

![图 9](/images/moe-2026/09.webp)

因为黑名单里明着写了 `convert`。但真正好玩的是最后那几行——**只要 include 出来的东西不是合法 UTF-8，服务端就自己帮你 base64**。所以根本不用 `convert`，随便找个不在名单里、能把文件变成二进制的过滤器就行，比如 `zlib.deflate`：

![图 10](/images/moe-2026/10.webp)

压缩后的字节不是 UTF-8，`preg_match('//u')` 失败，页面直接把压缩流吐成一行 base64。

丢进 CyberChef：`From Base64` → `Raw Inflate`（别选 Zlib Inflate，PHP 这个滤波器输出的是 raw deflate，不带 `78 9c` 头，选错了会报 `incorrect header check`）：

![图 11](/images/moe-2026/11.webp)

```php
<?php
$flag = "moectf{86e956a9-c19d-06e2-bf04-3369fa876c97}";
```

这题让我记住两件事：黑名单不是安全边界；还有用 `php://filter` 读源码时，必须让流"不再是 PHP 代码"，否则 include 直接把它执行掉了。

### 小结

| 题 | 关键点 | flag |
| --- | --- | --- |
| 查分系统 | 前端整表下发 + 字段无类型校验 | `moectf{y0u_c@n_reAd_th3_h+nn1}` |
| 古籍翻阅 | `book` 参数直接拼路径 | `moectf{re@d_the_r00t_5utr4_w1th_path_tr4v3r5@1}` |
| 七狗免费小说 | `zlib.deflate` 绕黑名单 + 输出侧自动 base64 | `moectf{86e956a9-c19d-06e2-bf04-3369fa876c97}` |

三题都不难，但那是我第一次觉得"题目在干嘛"能看明白的时候。现在再打一遍，速度快多了，可也少了当年一晚上卡在一句"咬你哦"上、最后突然想通的那种感觉，还挺怀念的。

就写到这里吧。moe 是第一站，这篇就当给那时候的自己留个档。
