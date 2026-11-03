# STC 本地检查工具

`check.mjs` 按本 skill 内置的规则和词表检查中文。运行时只需要 Node.js 18 以上版本，不依赖第三方包或网络。

## 用法

```bash
node <本 skill 目录>/tools/check.mjs README.md docs/
node <本 skill 目录>/tools/check.mjs src/pages/Settings.tsx
node <本 skill 目录>/tools/check.mjs AGENTS.md --profile for-instruction-writing
echo "本周我们进行了大量优化。" | node <本 skill 目录>/tools/check.mjs --profile for-document
```

| 选项 | 作用 |
|---|---|
| `--profile <场景>` | 指定 `for-chat`、`for-document`、`for-web-dev` 或 `for-instruction-writing` |
| `--format text` | 输出可读报告，默认格式 |
| `--format markdown` | 输出 Markdown 报告 |
| `--json` | 输出结构化问题，含位置、原句、原因和改法 |
| `--max-errors <n>` | 错误超过 n 个时返回退出码 1，默认 0 |
| `--no-warnings` | 只显示错误 |
| `--anti-echo` | 未复核的 G20 疑点会使检查返回 1 |
| `--review-decisions <文件>` | 读取与原文绑定的保留理由，与 `--anti-echo` 一起用 |

给目录时，逐层检查 Markdown、文本和代码文件，跳过以“.”开头的目录和 `node_modules`、`dist`、`build` 等目录。符号链接不继续展开。

不指定场景时，AGENTS.md、CLAUDE.md、SKILL.md 用 for instruction writing；代码文件用 for web dev，只检查字符串和 JSX 中的文字；其余文件用 for document。

## 报告

报告先给需修改项与待确认项的数量，再按原句分组。每条问题包含触发文字、原因、改法和规则编号。待确认项必须结合上下文判断，机器检查不能代替语义复核。

检查退出码：0 表示通过；1 表示错误超过上限或存在未复核的 Anti-Echo 疑点；2 表示参数或路径错误。

## Anti-Echo 复核

交付检查：

```bash
node <本 skill 目录>/tools/check.mjs 指定文档.md --anti-echo --json
```

报告的 `antiEcho.pending` 包含待复核原文、位置和 `id`。无用说明直接删除，再运行检查。必要边界可以保留，并将具体理由写进复核文件：

```json
{
  "version": 1,
  "decisions": [
    {
      "id": "从当前报告复制完整的 id",
      "decision": "keep",
      "reason": "报价单必须说明税费范围，避免客户按含税价格判断。"
    }
  ]
}
```

```bash
node <本 skill 目录>/tools/check.mjs 指定文档.md --anti-echo --review-decisions 审阅决定.json
```

保留理由与文件路径、完整文件校验值、位置、原文和触发文字绑定。文件改动后必须重新核对，旧记录不会豁免新文字。

## 检查范围

| 编号 | 检查 | 级别 |
|---|---|---|
| G3 至 G7 | 词表里的不推荐写法 | 错误；需要结合上下文的词是警告 |
| G12 | 一句超过 40 个字 | 警告 |
| G17 | 直角引号 | 错误 |
| G19 | 中文与英文、数字之间没有空格 | 警告 |
| G20 | 排除说明、自证和界面制作标签 | 待复核；`--anti-echo` 阻止未处理项通过 |
| C3 | 对话里的感叹号 | 错误 |
| D1 | 文档里的“他、她、它” | 错误 |
| W1 | 界面文字里的复数人称代词和第三人称代词 | 错误 |
| W2 | “你”和“您”混用 | 警告 |
| I1 | 规则文件里的非标准强度词 | 错误 |
| I2 | “必须”与“尽量、避免”等词连用 | 错误 |

不检查引号里的文字、代码块、行内代码、链接地址、代码注释、含“✗”的反例行，以及 `stc-disable-next-line` 注释后的下一行。

“一句只讲一件事”“先写结论”等语义规则仍须由 agent 按规则文件复核。
