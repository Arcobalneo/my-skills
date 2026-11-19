---
name: pi-init
description: 在新设备初始化 pi agent：从标准渠道安装最新版 pi 与三个必选插件，并按当前版本的实现核对 DeepSeek 的压缩配置。用户在新机器上安装 pi、搭建环境，或长会话反复压缩失败时使用。
tags: [pi, agent, 安装, 配置, DeepSeek, 上下文压缩]
scenes: [安装配置, 故障排查]
version: v4
---

# pi-init

只做三件事：装 pi、装三个必选插件、核对 DeepSeek 的压缩配置。其他扩展、自定义模型端点和代理、记忆系统、主题、快捷键不在范围内。

配置目录以 `~/.pi/agent` 为准。设置了 `PI_CODING_AGENT_DIR` 时，本文所有 `~/.pi/agent` 都换成该变量的值。

本文按 pi 1.5.2 核对（2026-11）。第三步的判据必须落在当前安装版本的实现上，不得套用历史结论。

## 第一步：从标准渠道安装最新版 pi

```bash
curl -fsSL https://pi.dev/install.sh | sh
pi --version
```

官方渠道只有三个：

| 渠道 | 命令 |
|---|---|
| 安装脚本（macOS / Linux） | `curl -fsSL https://pi.dev/install.sh \| sh` |
| npm（Node 22.19 以上） | `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` |
| Nix（macOS / Linux） | `nix profile add github:earendil-works/pi/stable` |

不得使用第三方镜像或旧版本包：本 skill 的结论取决于 pi 版本。已安装时升级用 `pi update --all`；Nix 安装用 `nix profile upgrade pi`。

## 第二步：安装三个必选插件

```bash
pi install npm:pi-web-access
pi install npm:@tintinweb/pi-subagents
pi install npm:@pify/shell-background
pi list
```

不带版本号时按 npm 的 latest 解析，三个包都必须装最新版；`pi list` 必须包含这三个包名，缺一个就先解决安装失败再继续。

| 包 | 提供的工具 |
|---|---|
| `pi-web-access` | `web_search`、`fetch_content`，以及视频理解 |
| `@tintinweb/pi-subagents` | `Agent`、`SubagentWorkflow`，以及 general-purpose / Explore / Plan 子代理类型 |
| `@pify/shell-background` | `shell_status`、`shell_kill`，并重新注册 `bash`：前台命令超过 30s 自动转后台，结束后把结果投递回会话 |

三个包都在 0.x，`settings.json` 只锁次版本（例如 `^0.47.0`、`^0.7.0`），`pi update --extensions` 不会跨次版本升级。跨次版本要写死版本号重装，例如 `pi install npm:pi-web-access@0.48.0`。

已装版本与仓库最新版对照：

```bash
node -e "for (const p of ['pi-web-access','@tintinweb/pi-subagents','@pify/shell-background']) console.log(p, require(process.env.HOME + '/.pi/agent/npm/node_modules/' + p + '/package.json').version)"
npm view pi-web-access version && npm view @tintinweb/pi-subagents version && npm view @pify/shell-background version
```

`@pify/shell-background` 重新注册 `bash`，与改写同一工具的插件互斥：pi 的 `registerTool` 后写覆盖。同机装了 `@pify/pretty` 时，`shell-background` 必须排在 `packages` 末尾、最后加载，否则异步 `bash` 会被覆盖回阻塞版本。自动转后台只在交互会话生效，`pi -p` 下用 `shell_status { id, wait: N }` 同轮收集。

## 第三步：核对 DeepSeek 的压缩配置

按当前安装版本的实现判断，不套历史结论：

```bash
PKG=$(cd "$(dirname "$(readlink -f "$(command -v pi)")")/../.." && pwd)
grep -n "reduced when needed so input and output fit the context window" "$PKG/docs/compaction.md"
```

命中：摘要输出预算在发送前就压进窗口（`pi-ai` 的 `clampMaxTokensToContext`，1.5.1 起），默认 `reserveTokens` 不会导致压缩失败，配置不动。已配 `modelOverrides` 的机器保留即可，只是压缩触发得更早。

不命中：当前版本没有这个 clamp，摘要按模型 `maxTokens` 原样发送，触发点加上它必然超出窗口。先升级到最新版；升级后仍不命中，才在 `~/.pi/agent/settings.json` 里给该模型把 `reserveTokens` 提到 `maxTokens` 以上，然后 `/reload`：

```json
{
  "compaction": {
    "modelOverrides": {
      "deepseek/deepseek-flash": { "reserveTokens": 450000 }
    }
  }
}
```

`modelOverrides` 的键必须与运行时的 `provider/modelId` 完全一致，区分大小写。

DeepSeek 官方模型（`deepseek/deepseek-flash`、`deepseek/deepseek-v4-pro`）：窗口 1,000,000，`maxTokens` 384,000。数值随目录变动，用下面这条取当前值：

```bash
grep -rho '"deepseek-flash".\{0,700\}' "$PKG/dist/bundle/chunks/" | head -1
```

## 第四步：验证

1. 长会话里 `/compact` 成功。
2. 跨过触发点后会话文件里出现压缩条目：

```bash
grep -c '"type":"compaction"' ~/.pi/agent/sessions/<项目目录>/<会话文件>.jsonl
```

3. 终端不再出现 `Auto-compaction failed`；出现就把报错原文留下，按第三步重判。
4. 交互会话里执行 `sleep 40`：30s 处应返回 `moved to the background`，40s 结束时把结果投递回会话；一直阻塞说明 `bash` 没被 `@pify/shell-background` 接管。

## 检查清单

- [ ] pi 来自官方渠道，且为最新版
- [ ] `pi list` 包含 `npm:pi-web-access`、`npm:@tintinweb/pi-subagents`、`npm:@pify/shell-background`，且版本等于 `npm view` 的最新版
- [ ] 第三步的锚点已在当前版本实跑；不命中时 `reserveTokens > maxTokens` 且已 `/reload`
- [ ] `/compact` 成功，没有 `Auto-compaction failed`
- [ ] 前台 `sleep 40` 在 30s 处转后台（`pi -p` 除外）

本 skill 为 my-skills 仓库原创，无上游。
