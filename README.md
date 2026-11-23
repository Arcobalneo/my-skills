# my-skills

个人 Agent Skill 收藏库（公开）。

Skill 按三种方式收录。完整规则见 [AGENTS.md](./AGENTS.md)。

| 方式 | 含义 |
| --- | --- |
| 方式 1 · 直接引用 | 只收录上游链接，本仓库不放文件副本。安装和使用去上游仓库。 |
| 方式 2 · 参考改造 | 本仓库有目录和文件，并标注上游与相对上游的改动。 |
| 方式 3 · 完全自研 | 本仓库原创，无上游。 |

## 已收录

| Skill | 说明 | 收录方式 | 上游 |
| --- | --- | --- | --- |
| [stc](./stc/) | STC（Simplified Technical Chinese）简明技术性中文写作、改写与审阅规范 | 方式 2 · 参考改造 | [daimonia-ai/STC-Simplified-Technical-Chinese](https://github.com/daimonia-ai/STC-Simplified-Technical-Chinese) |
| [answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) | 用一页 HTML 回答复杂问题（Answer me with HTML） | 方式 1 · 直接引用 | [QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) |
| [upy-project-adapter](https://github.com/AaronConlon/upy/tree/main/skills/upy-project-adapter) | 为应用项目接入 upy 部署，生成服务器配置、bundle、GitHub Actions Release 与 CI Webhook 自动部署 | 方式 1 · 直接引用 | [AaronConlon/upy](https://github.com/AaronConlon/upy) |
| [pi-init](./pi-init/) | 在新设备初始化 pi agent：安装 pi-web-access、pi-subagents、shell-background 三个必选插件，修正 DeepSeek 官方 provider 的压缩阈值 | 方式 3 · 完全自研 | 无 |
| [Humanizer-zh](https://github.com/op7418/Humanizer-zh) | 编辑已有文章、评论和文档中的空话、重复及模板化表达，保留事实、确定程度和作者声音 | 方式 1 · 直接引用 | [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) |
| [BeautifulRust](https://github.com/morganlinton/BeautifulRust) | 三套标准 Agent Skills 和一份 Clippy 配置，教编程助手编写、审阅、移植并检查地道 Rust 代码 | 方式 1 · 直接引用 | [morganlinton/BeautifulRust](https://github.com/morganlinton/BeautifulRust) |
| [show-me](https://github.com/humanlayer/skills/tree/main/plugins/show-me/skills/show-me) | 用简洁图示、代码结构草图和聚焦的 HTML 成品，可视化地帮助理解当前话题 | 方式 1 · 直接引用 | [humanlayer/skills](https://github.com/humanlayer/skills) |

## 使用

- **方式 1**：打开目录表中的上游链接，按上游仓库的说明安装。本仓库没有该 skill 的文件。
- **方式 2、方式 3**：把对应 skill 目录拷到你的 agent skills 目录，或按你所用平台的 skill 安装方式引用本仓库中的路径。每个 skill 以目录为单位，入口是该目录下的 `SKILL.md`。方式 2 有更新时对照该目录中的上游标注。
