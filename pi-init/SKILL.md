---
name: pi-init
description: 在新设备初始化 pi agent。从标准渠道安装最新版 pi 与三个必选插件，核对 DeepSeek 官方 provider 的压缩阈值与摘要输出预算。用户在新机器上安装 pi、搭建环境，或长会话反复压缩失败时使用。
tags: [pi, agent, 安装, 配置, DeepSeek, 上下文压缩]
scenes: [安装配置, 故障排查]
version: v4
---

# pi-init

本 skill 只覆盖三件事：从标准渠道安装 pi、安装三个必选插件、核对 DeepSeek 官方 provider 的压缩阈值与摘要输出预算。其他扩展、自定义模型端点和代理、记忆系统、主题、快捷键不在本 skill 范围内。

配置目录以 `~/.pi/agent` 为准。设置了 `PI_CODING_AGENT_DIR` 时，本文所有 `~/.pi/agent` 都必须换成该变量的值。

本文数值按 pi 1.5.2 核对（2026-11）。装到更高版本时，第三步必须以实机核对结果为准，不得直接套用第四步的数值。

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

必须使用上表中的渠道安装，不得使用第三方镜像或旧版本包。原因：本 skill 的结论取决于 pi 版本，旧版本的摘要输出预算算法不同，照抄会得到错误结论。

已安装 pi 时，升级用 `pi update --all`。Nix 安装不归 `pi update` 管，必须用 `nix profile upgrade pi`。

## 第二步：安装三个必选插件

```bash
pi install npm:pi-web-access
pi install npm:@tintinweb/pi-subagents
pi install npm:@pify/shell-background
pi list
```

不带版本号时按 npm 的 latest 解析，三个包都必须装最新版。`pi list` 输出必须包含这三个包名；缺一个说明该插件没装上，必须先解决安装失败，再继续。

| 包 | 提供的工具 |
|---|---|
| `pi-web-access` | `web_search`、`fetch_content`，以及视频理解 |
| `@tintinweb/pi-subagents` | `Agent`、`SubagentWorkflow`，以及 general-purpose / Explore / Plan 子代理类型 |
| `@pify/shell-background` | `shell_status`、`shell_kill`，并重新注册 `bash`：前台命令超过 30s 自动转后台，结束后把结果投递回会话 |

三个包都在 0.x，`settings.json` 记录的规格只锁次版本（例如 `^0.47.0`、`^0.7.0`），`pi update --extensions` 不会跨次版本升级。跨次版本升级必须写死版本号重装：

```bash
pi install npm:pi-web-access@0.48.0
```

已装版本与仓库最新版本用下面两条命令对照：

```bash
node -e "for (const p of ['pi-web-access','@tintinweb/pi-subagents','@pify/shell-background']) console.log(p, require(process.env.HOME + '/.pi/agent/npm/node_modules/' + p + '/package.json').version)"
npm view pi-web-access version && npm view @tintinweb/pi-subagents version && npm view @pify/shell-background version
```

`@pify/shell-background` 重新注册 `bash`，因此与改写同一工具的插件互斥：pi 的 `registerTool` 后写覆盖，两个扩展无法合并。同机装了 `@pify/pretty` 时（本 skill 不负责安装），`@pify/shell-background` 必须在 `packages` 数组中排在 `@pify/pretty` 之后、即最后加载；`pretty` 后加载会把异步 `bash` 覆盖回阻塞版本，插件装上也不生效。

自动转后台只在交互会话生效：`pi -p` 等无头模式不会自动转后台（显式 `background: true` 仍可用），此时用 `shell_status { id, wait: N }` 在同一轮内收集结果。

## 第三步：核对摘要输出预算是否够

改配置前必须完成本节核对。这块行为在 pi 1.5.1 变过一次，旧版本的判据不能沿用。

### 1. 确认当前版本是否先把输出预算压进窗口

```bash
PKG=$(cd "$(dirname "$(readlink -f "$(command -v pi)")")/../.." && pwd)
grep -n "reduced when needed so input and output fit the context window" "$PKG/docs/compaction.md"
grep -n "leaves 15% of the estimated input unused" "$PKG/CHANGELOG.md"
```

第一条命中：当前版本在发送摘要请求前就把输出预算压到“输入 + 输出 ≤ 窗口 − 余量”，默认配置不会再因两者相加超过窗口被上游以 400 拒绝。旧判据 `reserveTokens ≥ maxTokens` 已不适用，不得照搬。第二条是同一次改动的 changelog 佐证，用来确认引入版本。

第一条不命中、第二条命中：当前版本的文档措辞变过，重读 `$PKG/docs/compaction.md` 后再判断，不要按“不命中”处理。

两条都不命中：当前是 1.4.x 或 1.5.0。那时摘要按模型 `maxTokens` 原样发送，`reserveTokens ≥ maxTokens` 在当时是必须的；先升级 pi，再按本节重算。

原因：pi 1.4.0 取消了摘要的固定输出上限（`CHANGELOG.md` 的 `Summaries without a fixed output cap`），1.5.1 又补上按窗口 clamp（[#10497](https://github.com/earendil-works/pi/issues/10497)）。两步合起来才是现在的行为，只读到前一步会得出相反的结论。

### 2. 取数并算这个版本实际会发出的输出预算

- `reserveTokens`：`~/.pi/agent/settings.json` 的 `compaction.reserveTokens`，缺省 16384。
- `maxTokens` 与 `contextWindow`：从当前安装的模型目录取。

```bash
grep -rho '"deepseek-flash".\{0,700\}' "$PKG/dist/bundle/chunks/" | head -1
```

DeepSeek 官方模型在 pi 1.5.2 中的取值：`contextWindow` 1,000,000，`maxTokens` 384,000。

`clampMaxTokensToContext()`（`pi-ai/dist/api/simple-options.js`）的算法：

```text
余量     = max(4096, 15% × 估算输入)
余量不足 32768 时只留 4096，并把输出上限压到 32768
发出值   = min(模型 maxTokens, max(1, 窗口 − 估算输入 − 余量))
```

摘要请求不带显式输出上限，落回模型的 `maxTokens`，再被上式压低。代入 DeepSeek 官方模型（窗口 1,000,000、`maxTokens` 384,000）：

| `reserveTokens` | 触发点 | 摘要输入（约） | 实际发出 |
|---|---|---|---|
| 16384（默认） | 983,616 | 963,616 | 约 32,288 |
| 450,000 | 550,000 | 530,000 | 384,000 |

摘要输入按“触发点 − `keepRecentTokens`”估；工具结果在序列化时被截到 2000 字符、thinking 被丢弃，实际通常更小，余量更大。

### 3. 判断

发出值接近模型 `maxTokens`：不改配置，本次初始化到此结束。
发出值被压到明显低于摘要所需：按第四步提高 `reserveTokens`，触发得越早，摘要输入越小，留给输出的空间越大。

要看的是 DeepSeek 这类“输出上限占到窗口三分之一以上”的模型：默认触发点只剩约 32k 输出空间，而摘要请求带着会话的 `thinkingLevel` 发出，DeepSeek 的推理内容与正文共享同一个 `max_tokens`。推理占满时响应以 `stopReason: "length"` 结束，pi 判为 `Summarization failed: generation hit the token cap and the summary is incomplete`，压缩失败并在下一轮从同一位置重试。表现和 1.5.1 之前那个 400 卡死一样，成因不同：那时是输入加输出算不平，现在只是输出预算被推理吃掉。

## 第四步：输出预算不够时提高 reserveTokens

只在第三步判定发出值不够、或已出现 `generation hit the token cap` 时执行。在 `~/.pi/agent/settings.json` 中为 DeepSeek 模型单独提高 `reserveTokens`：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000,
    "modelOverrides": {
      "deepseek/deepseek-flash": {
        "reserveTokens": 450000
      }
    }
  }
}
```

改完必须在会话里执行 `/reload`。普通 `reserveTokens` 可省略，省略时回落到内置默认 16384；宜显式写出，便于对照。

`modelOverrides` 的键必须与运行时的 `provider/modelId` 完全一致，区分大小写。

DeepSeek 官方模型的取值：

| 模型 | 窗口 | maxTokens | 宜用 reserveTokens | 实际触发点 | 摘要请求实际发出 |
|---|---|---|---|---|---|
| `deepseek/deepseek-flash` | 1,000,000 | 384,000 | 450,000 | 550,000 | 384,000 |
| `deepseek/deepseek-v4-pro` | 1,000,000 | 384,000 | 450,000 | 550,000 | 384,000 |

450,000 让触发点落在 550,000：摘要输入约 530,000，clamp 后仍够 384,000，摘要按模型上限发满，推理不会挤掉正文。同时给本地估算与上游实际计数的偏差留了约 66K；中文内容的本地估算偏差较大，余量不宜压到 0。

代价是压缩触发得更早，长会话会多压缩几次。换用其他窗口或输出预算的模型时，按第三步的算式重算，不得照抄 450,000。

## 第五步：验证

1. 在长会话里执行 `/compact`，压缩必须成功。
2. 跨过触发点后，会话文件里必须出现压缩条目：

```bash
grep -c '"type":"compaction"' ~/.pi/agent/sessions/<项目目录>/<会话文件>.jsonl
```

3. 终端不得再出现 `Auto-compaction failed`。一旦出现，按报错归因：`This endpoint's maximum context length is ...` 属上下文溢出（1.4.x / 1.5.0 的旧现象），`generation hit the token cap and the summary is incomplete` 是输出预算不够，按第四步处理。
4. 交互会话里执行 `sleep 40`：30s 处应返回 `moved to the background`，命令在 40s 结束时把结果投递回会话；一直阻塞到 40s 说明 `bash` 没被 `@pify/shell-background` 接管，按第二步的加载顺序说明排查。

## 检查清单

- [ ] pi 来自官方渠道，且为最新版
- [ ] `pi list` 输出包含 `npm:pi-web-access`、`npm:@tintinweb/pi-subagents` 与 `npm:@pify/shell-background`
- [ ] 三个插件的版本等于 `npm view` 的最新版
- [ ] 前台 `sleep 40` 在 30s 处转后台（`pi -p` 无头模式除外）
- [ ] 已用 `reduced when needed so input and output fit the context window` 与 changelog 锚点确认当前版本是否自带按窗口 clamp，未命中时先升级再重算
- [ ] 若配置了 `compaction.modelOverrides`，第三步算出的摘要输出预算够摘要所需（DeepSeek 官方模型取 450,000）
- [ ] 长会话里 `/compact` 成功，且没有 `Auto-compaction failed`

本 skill 为 my-skills 仓库原创，无上游。
