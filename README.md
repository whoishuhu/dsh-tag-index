# dsh-tag-index

[简体中文](README.md) | [English](README.en.md)

一个 DeepSeek Harness 插件：安装后把 [DSH 插件索引（dsh-plugin 标签）](https://whoishuhu.github.io/dsh-plugin-index/) 加入「插件 → 发现」。这个索引收录 GitHub 和 npm 上所有打了 `dsh-plugin` 标签、可以安装的插件，每天更新。

## 它会做什么

只在每个 profile 第一次运行时做两件事：

1. 如果「插件 → 实验性插件 → 自定义插件索引」没有打开，就打开它，「发现」标签页由它提供。
2. 把 `https://whoishuhu.github.io/dsh-plugin-index/index.json` **追加**到你现有索引源的末尾。已有的索引源不删除、不改顺序。

之后你删掉这个索引源，或者关掉「自定义插件索引」，它都不会再加回来。想再加回来，在对话框输入 `/tag-index`。把本插件关掉再打开，也会重新设置一次。

它不安装其他插件，不发网络请求，也不改其他设置。

## 安装

在 DSH 里让 agent 用插件管理器安装：

```text
github:whoishuhu/dsh-tag-index
```

或者在终端运行（`dsh web` 用户）：

```sh
dsh plugin --profile web add github:whoishuhu/dsh-tag-index
```

装好后如果提示需要重启，重启 DSH 即可。

不想装插件也可以直接手动添加：「插件 → 发现 → 添加索引源」，粘贴上面的地址。

## 索引说明

索引怎么生成、收录规则和限制，见 [whoishuhu/dsh-plugin-index](https://github.com/whoishuhu/dsh-plugin-index)。收录不等于审核，安装插件前请在确认框里核对来源。

## 许可证

MIT。独立社区项目，与 DeepSeek 官方无隶属关系。
