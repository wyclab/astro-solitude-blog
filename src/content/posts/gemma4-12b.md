---
title: 'Gemma4-12B本地部署，0token的个人助理'
date: '2026-06-07 15:00'
description: 'Gemma4-12B 依托于强大的 120 亿参数模型，它在本地环境中即可流畅运行。处理敏感隐私文档、进行长篇逻辑推理，还能作为你的全天候创作伙伴'
categories:
- 科技
tags:
- AI
- 谷歌
cover: 'https://static.wyclab.com/gemma-4_blog_keyword_meta-dark.width-1300260607.png'
---




## 安装Gemma4-12B

> Gemma4-12B发布于2026年6月，参数量120亿，只需 **16GB VRAM（显存）或苹果 Mac 的统一内存**即可流畅运行。
>
> Gemma 4 12B 支持高达 **256K 的上下文窗口**（Context Window）。在本地运行时，你可以直接把一整本书、长篇研报或是数十个代码文件一次性“喂”给它，而它能保持极高的信息召回率。
>
> 

### 1. 下载LM-studio

访问 [https://lmstudio.ai/](https://lmstudio.ai/]) 下载，

**LM Studio** 是一款非常强大且易于使用的**本地大语言模型（LLM）运行工具**。它允许用户在自己的电脑上（完全离线）下载、安装和运行各种开源大模型。

### 2. 本地部署Gemma4-12B

在LM-studio中一键安装Gemma4-12B，小白傻瓜式。安装好后就可以使用了。

![image-20260607212315331](https://static.wyclab.com/image-20260607212315331260607.png)

### 3. 内存占用实测

实测MacBook Air M5 16GB，上下文开不到256K，只能开到25K左右，内存占用大约10GB左右。对话时GPU占用是100%。

![image-20260607212859660](https://static.wyclab.com/image-20260607212859660260607.png)

## 开始使用

本地部署后，可以作为可离线使用的、本地运行的AI助理，智商在线，不怕隐私泄漏，可以在本地处理基本的任务。

### 1. 翻译助理

提示词：翻译成中文

![image-20260607211012423](https://static.wyclab.com/image-20260607211012423260607.png)

### 2. ocr助理

提示词：ocr

![image-20260607210855843](https://static.wyclab.com/image-20260607210855843260607.png)

### 3. 制表助理

提示词：将上述内容做成表格

![image-20260607210929545](https://static.wyclab.com/image-20260607210929545260607.png)

### 4. 写作/code助理

![image-20260607213229913](https://static.wyclab.com/image-20260607213229913260607.png)