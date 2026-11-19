---
name: pi-init
description: 在新设备初始化 pi agent。从标准渠道安装最新版 pi 与三个必选插件，核对并修正 DeepSeek 官方 provider 的压缩阈值。用户在新机器上安装 pi、搭建环境，或长会话反复压缩失败时使用。
tags: [pi, agent, 安装, 配置, DeepSeek, 上下文压缩]
scenes: [安装配置, 故障排查]
version: v3
---

# pi-init

本 skill 只覆盖三件事：从标准渠道安装 pi、安装三个必选插件、核对并修正 DeepSeek 官方 provider 的压缩阈值。其他扩展、自定义模型端点和代理、记忆系统、主题、快捷键不在本 skill 范围内。

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

## 第三步：核对是否需要改压缩阈值

改配置前必须完成本节核对。DeepSeek 官方模型的窗口很大、输出上限也很大，默认配置会让压缩必失败；但上游改动过这块行为，旧结论不能直接沿用。

### 1. 确认摘要请求仍按模型输出上限发

```bash
PKG=$(cd "$(dirname "$(readlink -f "$(command -v pi)")")/../.." && pwd)
grep -n "Summary requests use the model's output limit" "$PKG/docs/compaction.md"
```

命中说明当前版本仍是“摘要按模型 `maxTokens` 发、`reserveTokens` 只决定何时触发”，继续第 2 步。输出为空说明上游改动了这块行为：必须重读 `$PKG/docs/compaction.md` 和 `$PKG/CHANGELOG.md`，按新的输出上限重新计算，不得套用本文数值。

原因：pi 1.4.0 起取消了摘要的固定输出上限，见 `CHANGELOG.md` 的 `Summaries without a fixed output cap`。这是设计变更，不是待修缺陷，只能改配置适配。

### 2. 取模型的两个数字

- `reserveTokens`：`~/.pi/agent/settings.json` 的 `compaction.reserveTokens`，缺省 16384。
- `maxTokens` 与 `contextWindow`：从当前安装的模型目录取。

```bash
grep -rho '"deepseek-flash".\{0,700\}' "$PKG/dist/bundle/chunks/" | head -1
```

DeepSeek 官方模型在 pi 1.5.2 中的取值：`contextWindow` 1,000,000，`maxTokens` 384,000。

### 3. 判断必要性

判据：`reserveTokens ≥ maxTokens` 时不改配置，本次初始化到此结束；不成立时按第四步改。

默认 16384 小于 384000，DeepSeek 官方模型默认不满足判据。日常会话远低于触发点（约 55 万 token）时，可暂不改；一旦出现下面的现象，必须按第四步改。

现象：自动压缩触发后，摘要请求被上游以 400 拒绝，终端报 `Auto-compaction failed: ...`；此后每轮重试同一个必然失败的请求，会话无法继续推进。

原因：触发点是 `窗口 − reserve`，摘要请求最大为触发点输入加 `maxTokens`，默认配置下 `983,616 + 384,000 = 1,367,616`，超出 1,000,000 的窗口。上游拒绝后 pi 不会压低输出预算重试，这次压缩就此失败。上下文继续增长后仍从同一位置触发，于是会话卡死。

## 第四步：判据不成立时提高 reserveTokens

只在第三步判据不成立、或已出现上述现象时执行。在 `~/.pi/agent/settings.json` 中为 DeepSeek 模型单独提高 `reserveTokens`：

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

| 模型 | 窗口 | maxTokens | 宜用 reserveTokens | 实际触发点 | 摘要请求上限 |
|---|---|---|---|---|---|
| `deepseek/deepseek-flash` | 1,000,000 | 384,000 | 450,000 | 550,000 | 934,000 |
| `deepseek/deepseek-v4-pro` | 1,000,000 | 384,000 | 450,000 | 550,000 | 934,000 |

450,000 在 384,000 之上留了约 66K 余量，用于吸收本地 token 估算与上游实际计数的偏差；中文内容的本地估算偏差较大，余量不宜压到 0。

代价是压缩触发得更早，长会话会多压缩几次。换用其他窗口或输出预算的模型时，必须按 `reserveTokens ≥ maxTokens` 重新计算，不得照抄 450,000。

## 第五步：验证

1. 在长会话里执行 `/compact`，压缩必须成功。
2. 跨过触发点后，会话文件里必须出现压缩条目：

```bash
grep -c '"type":"compaction"' ~/.pi/agent/sessions/<项目目录>/<会话文件>.jsonl
```

3. 终端不得再出现 `Auto-compaction failed`。
4. 交互会话里执行 `sleep 40`：30s 处应返回 `moved to the background`，命令在 40s 结束时把结果投递回会话；一直阻塞到 40s 说明 `bash` 没被 `@pify/shell-background` 接管，按第二步的加载顺序说明排查。

## 检查清单

- [ ] pi 来自官方渠道，且为最新版
- [ ] `pi list` 输出包含 `npm:pi-web-access`、`npm:@tintinweb/pi-subagents` 与 `npm:@pify/shell-background`
- [ ] 三个插件的版本等于 `npm view` 的最新版
- [ ] 前台 `sleep 40` 在 30s 处转后台（`pi -p` 无头模式除外）
- [ ] 已核对当前版本的摘要输出上限，未命中时重新计算而非照抄
- [ ] 若配置了 `compaction.modelOverrides`，覆盖值满足 `reserveTokens ≥ maxTokens`
- [ ] 长会话里 `/compact` 成功，且没有 `Auto-compaction failed`

本 skill 为 my-skills 仓库原创，无上游。
