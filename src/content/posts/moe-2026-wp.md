---
title: 【2026moe】WP
published: 2026-10-20
description: moe才是我的第一站，虽然当时啥也不懂（现在也一样），就纯打着玩，要是感兴趣你可以看看？做这篇主要是纪念一下啦
tags: [WP, CTF, Web]
category: WP
draft: false
---

> moe才是我的第一站，虽然当时啥也不懂（现在也一样），就纯打着玩，要是感兴趣你可以看看？做这篇主要是纪念一下啦

三道题都是 2026 年 moe 的题目，2026-10-20 晚上又重做了一遍（几周不打直接生锈），过程如下

> 📑 所有 WP 的总目录在 [WP 索引](/wp/)。

### 一、查分系统

这题是查期末成绩，页面上只有一个学号框和一个查询按钮

正常操作只能查到自己那一条，所以根本不用输学号，直接 F12 看它到底发了什么。结果 `<script>` 里不是初始化参数，而是整张成绩表：序号、学号、姓名、专业，还有一堆 `I-1-1`、`II-3-2` 这种小分，最后是总分和折合

![图 1](/images/moe-2026/01.webp)

大声告诉你，出题人总喜欢在一堆没有的信息里藏flag，翻着翻着就找到啦，什么？你说你看不见？Ctrl+F会拯救你的！！
翻到第 47 条记录，`总分` 是 123，下面紧跟着的"折合"本该是个数字，却塞了一串字符串，看我说什么来着：

![图 2](/images/moe-2026/02.webp)

```
moectf{y0u_c@n_reAd_th3_h+nn1}
```

挺典型的"前端把背后整张表都发出来了"：前端你也敢藏东西？本来就是新手题啦，确实很适合新生宝宝体质

### 二、古籍翻阅

站点是个古籍检索页，正常的书链接长这样：`/read?book=jing/chunqiu/index`。

Burp 抓首页，响应有十七万字节，在响应里搜 `true`，（你问我怎么找到的？我说眼睛看瞎看出来的你信吗（））能翻到一条画风不太一样的：

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

典型的路径穿越咯，那就顺着往上爬：

![图 5](/images/moe-2026/05.webp)

```
/read?book=../../flag
```

```
moectf{re@d_the_r00t_5utr4_w1th_path_tr4v3r5@1}
```

`book` 参数被直接拼进文件路径，没做规范化，直接————跳到服务器根目录

### 三、七狗免费小说

这题倒是有点绕，我已经忘了当时怎么做的了，总感觉有点？？不一样？？

站点叫「刻俄柏的小说」，三个链接：`?file=chap1.html`、`?file=chap2.html`、`?file=flag.php`。

![图 6](/images/moe-2026/06.webp)

先顺手翻了首页源码：页面里藏着一个 `display:none` 的 div，用 `highlight_file(__FILE__)` 把**首页 index.php 自己**的源码打了出来，黑名单就是从这儿看到的：

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

`?file=flag.php` 只是**执行**它，页面上最多冒出一句「Flag 就在上面，只有聪明的人才能看见」，而 flag 老老实实待在 `$flag` 变量里，根本没被 echo 出来。想拿到它得绕开 include，直接读它的**源码**：

```php
<?php
$flag = "moectf{86e956a9-c19d-06e2-bf04-3369fa876c97}";
echo "Flag 就在上面，只有聪明的人才能看见<br>...";
// 小刻的碎碎念……
?>
```



第一反应当然是 `convert.base64-encode`，然后喜提一句"咬你哦！"，可以咬回去嘛（）：

![图 9](/images/moe-2026/09.webp)

因为黑名单里明着写了 `convert`。但真正好玩的是最后那几行——**只要 include 出来的东西不是合法 UTF-8，服务端就自己帮你 base64**。所以根本不用 `convert`，随便找个不在名单里、能把文件变成二进制的过滤器就行，比如 `zlib.deflate`：

![图 10](/images/moe-2026/10.webp)

压缩后的字节不是 UTF-8，`preg_match('//u')` 失败，页面直接把压缩流吐成一行 base64

丢进 CyberChef：`From Base64` → `Raw Inflate`（别选 Zlib Inflate，PHP 这个滤波器输出的是 raw deflate，不带 `78 9c` 头，选错了会报 `incorrect header check`）：

![图 11](/images/moe-2026/11.webp)

```php
<?php
$flag = "moectf{86e956a9-c19d-06e2-bf04-3369fa876c97}";
```

顺手把其他滤波器也试了一遍：`string.rot13`、`convert.quoted-printable-encode` 全都撞在黑名单上（`string`、`convert` 开头就没了），`zlib.inflate` 对明文直接报错，`phar://` 也没用。能绕过去的只剩 `zlib.deflate` 这一条

这题有两个点值得记：黑名单不是安全边界；还有用 `php://filter` 读源码时，必须让流"不再是 PHP 代码"，否则 include 直接把它执行掉了（少废话，大肥鱼叫你记你就记）

### 小结

| 题 | 关键点 | flag |
| --- | --- | --- |
| 查分系统 | 前端整表下发 + 字段无类型校验 | `moectf{y0u_c@n_reAd_th3_h+nn1}` |
| 古籍翻阅 | `book` 参数直接拼路径 | `moectf{re@d_the_r00t_5utr4_w1th_path_tr4v3r5@1}` |
| 七狗免费小说 | `zlib.deflate` 绕黑名单 + 输出侧自动 base64 | `moectf{86e956a9-c19d-06e2-bf04-3369fa876c97}` |

三题的简单回顾~，重做一遍倒是把当初没细想的几个点补上了

没有了哦
