# Hermes 只承担生成，编排权留在 Harness

知识系统的生成层不是"一次 completion"，而是"读多份素材 → 分块 → 决定怎么整合 → 写字 → 可能建文件"的**带工具循环**，因此需要一个 agent 运行时。选定的运行时是 **Hermes Agent**（NousResearch，MIT，自托管），通过 `hermes acp` 以 ACP 协议（JSON-RPC over stdio）接入，home 在 `~/.hermes/`。

但 Hermes **一个字都不判断**，决策层（Jev 类）**一个字都不写**——两者都不是完整的编排者。因此把编排切成两半：

| 场景 | 编排者 | 形态 |
|---|---|---|
| 聊天（用户在场的开放对话） | **Hermes 自主驱动** | ACP 会话，多轮，agent 自己决定调哪些工具 |
| 四个 Hook（收集 / 解析 / 关联 / 蒸馏） | **我们的 Harness** | 确定性代码串联；Hermes 只在"该写字"那一步被叫进来 |

核心原则：**不给不确定的东西以编排权**。「收集器入库」本来就不该由 LLM 决定——它不判断。「蒸馏写字」才需要 agent。这与 ADR-0001 的「决策层 ≠ 生成层」是同一条思路：**职责按能力切，不按方便切**。

## Considered Options

- **A · 前后台分治（采纳）** —— 聊天交给 agent 自主，四个 Hook 由确定性代码编排。副产品：收集器与解析器零 token，低配设备上省往返。
- **B · 全交给 Hermes** —— 一个常驻会话，四个 Hook 写成 skill，Jev 以 MCP 工具形式喂给它，演化记录由它通过工具写。放弃原因：要求 LLM 可靠地吐结构化事件；低配设备上 token 与往返不可控；不可信输入能左右它的下一步。
- **C · 全外置** —— Hermes 完全无状态、每次单步调用。放弃原因：放弃了 `state.db` 这本现成的会话账，等于自己再建一套；而领域实体本来就要自己存（见下），再叠一层没有收益。
- **照抄 multica 的 `HERMES_YOLO_MODE=1`** —— 该仓库在调用 Hermes 时写死此变量，全自动批准所有工具调用，并为此搭了一套 per-task `HERMES_HOME` overlay。放弃原因见下 D2：那套复杂度是给多租户用的，且与我们的威胁模型冲突。

## Consequences

### 1 · 工具集白名单是安全硬约束，不是偏好

素材是用户投进来的**不可信内容**。Hermes 的 ACP 工具集含 `terminal` 与 `execute_code`，能执行任意命令。公开案例：往上下文注入一个伪造的"工具输出"字段，就把一个拦截决策从 `0.76 / 置信度 0.64` 打到 `0.48 / 0.22`。

| toolset | 状态 | 理由 |
|---|---|---|
| file（read / write / patch / search） | **开** | 蒸馏要读写素材与知识点 |
| skills | **开** | 四个 Hook 的写字步骤以 skill 形式组织 |
| session_search | **开**（只读） | 关联器要回溯历史对话 |
| vision | 按需 | 图片素材解析 |
| memory | **关** | 与知识点语义冲突，见 D3 |
| todo | **关** | 单用户单库无此需求 |
| web / browser | **关** | 素材由用户投进来，不由 agent 自行上网取料 |
| **terminal** | **关** | 执行任意命令 = 把执行权交给不可信输入 |
| **execute_code** | **关** | 同上 |
| delegate_task | **关** | 单用户场景无收益，且放大不可控面 |

配套：凡要**写入图谱**这类有后果的动作，`confidence` 阈值之外必须**另有一道确定性检查**（延续 ADR-0001 的约束）。

### 2 · cwd 边界 = 知识空间根目录

Hermes 的文件工具都相对 cwd。规定 agent 的 cwd 恒为知识空间根，没有越权路径。设置页**不暴露"工作目录"给用户改**——那是边界，不是偏好。

### 3 · 「运行记忆」与「知识点」严格分名分物

`~/.hermes/memories/` 是 agent 为**自己**写的私有草稿（`MEMORY.md` 约 2200 字符 + `USER.md` 约 1375 字符，为 LLM 前缀缓存服务，用户看不见，且**会话开始时冻结快照**）。知识点是**用户的资产**，要能打开、要进图谱。

两者共用"记忆"一词必然产生"AI 记得但用户找不到"。术语约定：前者一律叫**运行记忆**，后者一律叫**知识点**。运行记忆有硬上限且冻结快照，它不可能承担知识存储——这个区分不是洁癖，是能力决定的。

### 4 · 会话归属：不读 `state.db`

`state.db`（SQLite + FTS5）存全部转写、跨重启可恢复，但那是 **agent 的会话账**，表结构属于 Hermes 内部实现。我们的「对话素材」是**领域实体**——需要 id、要进来源关系、要被知识点的来源列表引用。

决策：**领域实体自己存**。Hermes 的 `state.db` 归它自己管，我们不读。打通方式是在蒸馏时把对话内容**显式喂给** agent。代价是 agent 通过 `session_search` 检索它的历史、我们检索我们的——两份历史，各自服务各自的目的。

### 5 · 一个 home 一个 agent，因此串行化

Hermes 的硬约束：两个进程指向同一 home 会互相污染运行记忆。部署上因此**串行化**调用：Harness 复用同一个 home 与常驻 gateway，不做 per-task overlay。

### 6 · 规格书需要新增一节

「Agent 接入层」写入 DESIGN-SPEC §9.6，承载本 ADR 的全部条款；设置页新增「AI 模型」面板（§5.4），配置归属见 ADR-0003。

## 后续修订（2026-09-28 · 以 Hermes 源码为准校核白名单）

> 依据：本机**已安装**的 Hermes 源码 `%LOCALAPPDATA%\hermes\hermes-agent/`，版本 `v0.21.4+canary.20260927T065737Z-633-g6e69a8933a`（commit `6e69a8933a`）。权威定义在 `toolsets.py::TOOLSETS`。**只读源码与 git，未执行 hermes、未改动任何配置。**
> 附带的发现：本机早就装好了 Hermes（1.07 GB / 58551 文件，`state.db` 16 MB，config 备份日期 20260515），只是没进 PATH。→ **M0a 不需要再安装**，装上设备时另说。

### 1 · 白名单里有两个名字写错了：工具名 ≠ 工具集名

`--toolsets` / `hermes tools` / `disabled_toolsets` 收的是**工具集名**，`validate_toolset()` 只认工具集名。本 ADR 原表有两行误用了**工具名**：

| 原表写法（错） | 正确的工具集名 | 该工具集里装的工具 |
|---|---|---|
| `execute_code` | **`code_execution`** | `execute_code` |
| `delegate_task` | **`delegation`** | `delegate_task` |

其余九项（`file` / `skills` / `session_search` / `vision` / `terminal` / `web` / `browser` / `memory` / `todo`）**核对无误**，不用改。

不改的后果：`--toolsets` 会直接把这两个值当非法值拒掉，白名单配不进去。

### 2 · `file` 是原子的，按路径切分做不了 —— 作用域切必须换一处落

源码定义（原文）：

```python
"file": _ts("File manipulation tools: read, write, patch (with fuzzy matching), and search",
            ["read_file", "write_file", "patch", "search_files"])
```

四个工具**同一个开关**，工具集系统**没有 per-path 粒度**。

→ ADR-0005 修订那句「`file` write/patch：知识空间根关 · `~/.hermes/` 开」**无法用工具集开关表达**。落地改到宿主侧：ACP 里 agent 通过 **`session/request_permission`** 反向请求（multica 的 handler 也证实这条存在），**由我们的宿主应答**——写目标不在 `~/.hermes/` 的一律拒。

这样作用域切从"配置项"变成"我们代码里的一个判断"，反倒更硬。

> **待实机验证**：确认 `request_permission` 的载荷里带得着写入路径（并入 M0a 的 1c）。

### 3 · 一条顺带确认

`skills` 工具集 = `skills_list` / `skill_view` / **`skill_manage`** —— agent **能自己创建与编辑技能**。这与 ADR-0005 修订「放开用户技能」方向一致，不是意外。
