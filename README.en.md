# dsh-tag-index

[简体中文](README.md) | [English](README.en.md)

A DeepSeek Harness plugin that adds the [DSH Plugin Index (dsh-plugin tag)](https://whoishuhu.github.io/dsh-plugin-index/) to Plugins → Discover. The index lists every installable plugin tagged `dsh-plugin` on GitHub or npm and is rebuilt daily.

## What it does

Only on the first run in each profile:

1. If Plugins → Experimental plugins → Custom plugin index is off, it switches it on. That bundle provides the Discover tab.
2. It **appends** `https://whoishuhu.github.io/dsh-plugin-index/index.json` after your existing index sources. Your sources are not removed or reordered.

If you later remove the source or switch Custom plugin index off, it stays that way. Type `/tag-index` in the composer to add the source again. Switching this plugin off and on also sets it up again.

It installs no other plugins, makes no network requests and changes no other settings.

## Install

Ask the agent in DSH to install this with the plugin manager:

```text
github:whoishuhu/dsh-tag-index
```

Or, for `dsh web`, from a terminal:

```sh
dsh plugin --profile web add github:whoishuhu/dsh-tag-index
```

Restart DSH if it asks you to.

You can also skip the plugin: open Plugins → Discover → Add index source and paste the address above.

## About the index

How the index is built, what it lists and its limits: [whoishuhu/dsh-plugin-index](https://github.com/whoishuhu/dsh-plugin-index). Listing is not review; check the source in the install dialog before installing a plugin.

## License

MIT. Independent community project, not affiliated with DeepSeek.
