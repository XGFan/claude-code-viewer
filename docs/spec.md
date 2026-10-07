# Claude Viewer 第一版规格

术语见 [CONTEXT.md](../CONTEXT.md)，关键取舍见 [docs/adr/](./adr/)。

## 定位

只读的 macOS 桌面应用，用来查看 `~/.claude` 下 Claude Code 的历史 Session。核心场景有两个：**找回某次对话**（搜索、定位）和**复盘某个 Session**（读得舒服）；统计是附加功能。不对 Session 做任何写操作（ADR-0002）。

## 平台与分发

- Tauri：Rust 后端负责解析、索引和监听，Web 前端负责全部 UI（ADR-0001）。
- 自用：本地构建，ad-hoc 签名，不做公证，不做自动更新；不开沙盒；macOS 14+，只出 Apple Silicon 版本。
- 仓库按可以开源的标准组织：有 README 和构建说明，不写死个人路径。

## 数据模型

- **Session** 以 session ID 为身份。符号链接导致的重复文件在扫描时按 realpath/inode 去重；同一个 ID 的多份真实拷贝按消息 uuid 取并集合并。
- **Project** 以 Session 启动时 cwd 的 realpath 为身份；Session 中途 cd 到别的目录不改变归属；目录已不存在时用原始路径，并标记"目录已不存在"。不支持手动合并 Project。
- **Subagent Run**：通过 `subagents/agent-<id>.meta.json` 里的 `toolUseId` 关联到主对话中的 Agent 调用，可以嵌套（`spawnDepth`）。
- **Workflow Run**：来自 `workflows/` 和 `journal.jsonl`。
- **Fork**：和其他 Session 共享消息 uuid 的 Session，独立显示，标注 Origin Session，继承来的历史默认折叠。
- **Branch / Main Line**：消息按 parentUuid 构成一棵树。Main Line 是走到最新叶子的那条路径（优先用 `last-prompt.leafUuid`，否则取时间戳最新的叶子）。
- **compact**：compact 边界会切断 parentUuid 链；边界通过 `logicalParentUuid` 接回压缩前的历史，但只接受文件中位置更早的条目（否则会成环），找不到时接到文件中前一条消息，因此 Main Line 跨越 compact 保持连续。
- **Fork 判定**：条目带 `forkedFrom` 的即为 Fork，继承部分以此标记；没有该字段时，以和更早的 Session 共享首条消息作为兜底。
- **Live Session**：`~/.claude/sessions/<pid>.json` 存在、进程存活且 `procStart` 一致；`status` 区分 busy 和 idle。兜底规则：文件最近几分钟内被修改过。
- 标题优先级：`custom-title` > `ai-title` > 第一条用户输入。
- **用户输入的判定**：只有用户亲手输入的内容和斜杠命令算作"你"的消息；系统注入、任务通知、命令输出、compact 摘要和 Teammate Message 都不算，不参与消息数、分支、标题和"你"角色的搜索。
- **计数口径**：消息数 = 用户输入 + assistant 消息（按 `message.id` 合并拆分的片段），只计主对话；token 按 `message.id` 只计一次，每个字段取各片段的最大值；Session 的 token 合计包含其 Subagent。
- 数据根目录：默认 `~/.claude`，识别 `CLAUDE_CONFIG_DIR`，也可以在设置里修改；只支持一个数据根目录。不读取 `~/.claude/transcripts/`。

## 索引

- 可以丢弃的镜像缓存，存放在 `~/Library/Caches/<bundle-id>/`；源文件删除后对应 Session 随之消失；schema 变化时直接重建（ADR-0003）。
- 增量方式：按文件记录已读到的字节偏移；文件变小或 inode 变化时整个文件重新解析。用 FSEvents 监听变化。
- 首次启动先扫描元数据，几秒内列表就能用；全文索引在后台分批构建，状态栏显示"正在建立全文索引 · x / y 个文件"；文件变更会插队处理，之后索引继续。实测 3 GB 数据约 2–3 分钟建完，索引约 760 MB。
- 宽容解析：以行为单位，失败的行跳过并计数；未知的条目类型、内容块、工具都用通用方式显示，不丢内容；所有字段按可选处理。

## 搜索

- 语义：字面子串匹配，支持多词 AND、`"短语"`、`-排除词`；过滤器有 Project、时间、角色、Live。
- 默认范围：用户输入、Claude 回复、工具输入，用 SQLite FTS5 trigram 索引；少于 3 个字符的词（如两个汉字）改用子串匹配，这种情况下只对 ASCII 字母忽略大小写。
- 打开"包含工具输出"时：工具输出不建索引，用 Rust 并行扫描源文件，结果流式返回，耗时在秒级；修改条件或关闭浮层即取消（ADR-0004）。
- 输入法组字期间不发起搜索，确认上屏后才搜索（⌘F 同理）。
- 不建索引：attachment、hook 输出、系统注入、图片、元数据。
- 结果按 Session 分组，默认按时间倒序；命中位置在 Subagent 里时标注其 agentType，在已回退的 Branch 里时标注"已回退的分支"；打开命中会自动切换分支、打开 Subagent 面板并定位高亮。
- 不做语义搜索，但保留以后扩展的可能。

## 界面

- 三栏布局：Project（"全部"默认选中，按最近活跃排序）| Session 列表 | 对话区；⌘K 打开全局搜索浮层；左栏底部是"统计"入口和设置按钮（⌘,）。
- 侧栏的"全部 Session"和 PROJECTS 标题固定，只有 Project 列表滚动。
- 打开 Subagent 面板、统计页时，Session 列表栏让出宽度。
- 各栏头部、对话头部、统计页头部和底部状态栏可以按住拖动窗口（按钮、输入框除外）。
- Session 列表每行显示：标题、相对时间、消息数、token 数（可以排序）、Live 标记、git 分支；从统计下钻时，列表顶部显示可清除的筛选标签。
- Session 头部显示：模型、token（输入/输出/缓存）、时长、消息数、工具调用次数、Subagent 数。
- 对话渲染：
  - 每个工具调用折叠成一行摘要；连续的工具调用合并成一组；失败的调用默认展开。
  - 专用渲染器：Bash（终端风格，支持 ANSI）、Edit（diff）、Write、Read（默认不展开内容）、AskUserQuestion、Task 清单；其他工具用通用 JSON 视图。
  - 思考块：有内容时折叠显示，空的隐藏。
  - attachment 和系统注入默认隐藏，可以用开关显示。
  - compact 边界显示为分隔线；`tool-results/*.txt` 按需加载；图片显示缩略图。
  - Branch 用 `‹ i/n ›` 切换；如果被放弃的分支只是原样重发且后面没有回复，不显示切换器。
  - 斜杠命令像终端一样高亮：命令名用等宽强调色，参数保持正文字体。
  - Teammate Message 显示为可折叠的"Teammate · <id>"卡片，不显示为用户气泡。
  - 当前 Session 读取失败时显示一行错误；源文件被删除时回到空状态。
- Subagent：主对话中显示为卡片（任务 + 结果）；"查看完整过程"在右侧面板打开，嵌套时显示面包屑；后台 agent 的卡片和结果通知互相链接；Workflow 显示为一张总卡片。
- 阅读便利：⌘F（会自动展开折叠的内容，包括工具组内的思考块和截断的工具输出）、`j`/`k` 按轮次跳转（对话框打开时不响应）、轮次大纲、复制消息/代码块/Bash 命令、复制 Session ID 和 `claude --resume <id>`、在 Finder 中显示。
- 不做：导出、URL scheme、书签和笔记、金额换算、任何写 Session 的操作。

## 统计面板

时间范围和 Project 过滤；概览卡片（Session 数、消息数、输出 token、活跃天数）；每日 token 柱状图（按模型堆叠，默认只看 output）；热力图（按日 / 星期 × 小时）；Project 排行；工具调用次数和失败率；按 agentType 的 Subagent 统计。页面铺满窗口高度。

- 口径：消息数和热力图只计主对话；token（概览、每日、Project 排行）包含 Subagent；工具调用包含 Subagent 内的调用。日期按本机时区划分。
- 下钻：点击柱子、热力图格子、工具、agentType、模型图例会筛选 Session 列表，并带上当前的时间范围；点击 Project 排行则切换到该 Project。

## 诊断

在设置（⌘,）的"格式兼容性"页：解析失败的行（含文件与首个错误）、未知的条目类型 / 内容块 / 系统子类型 / 工具名及出现次数和涉及版本、各 Claude Code 版本汇总、文件内重复 uuid 数、未关联的 Subagent 数；可复制报告、重建索引。

## 设置

数据根目录按"设置中的覆盖 → `CLAUDE_CONFIG_DIR` → `~/.claude`"确定；覆盖值保存在 `~/Library/Application Support/<bundle-id>/settings.json`，切换后清空当前视图并重新扫描。

## 测试

- 解析器的回归测试使用 fixture：从真实 Session 精简后脱敏（保留结构，文本替换成占位内容），覆盖 Branch、Fork、compact、Subagent、Workflow、后台 agent、失败的调用、图片等情况。
- E2E：Playwright 驱动前端并 mock IPC（`tauri-driver` 不支持 macOS）；Rust 后端单独测试。
- 启动、后台调度、配置类流程必须在真实应用中验证（单测覆盖不到，例如曾出现的全文索引任务互相让位导致永不执行）。

## 技术栈

React + TypeScript + Vite；Tailwind + shadcn/ui（macOS 风格，跟随系统深浅色）；TanStack Virtual；react-markdown + remark-gfm；Shiki（在 Worker 中运行）；`diff`；ECharts；specta + tauri-specta；rusqlite（元数据、统计、FTS5）。

## 里程碑

| | 内容 | 状态 |
|---|---|---|
| **M0 设计** | 用 Claude Design 出设计稿：主界面（浅色 + 深色）、Subagent 面板、⌘K 搜索、统计面板、状态类画面（首次索引、空结果、诊断页）。使用合成数据，macOS 原生质感，以浅色为主 | 已完成 |
| **M1 骨架** | 扫描和增量索引、FSEvents 监听、去重与合并、三栏布局、基础对话渲染、Live 标记和实时追随、宽容解析、fixture 测试、Session 头部元信息 | 已完成 |
| **M2 读得舒服** | 工具渲染器、工具调用分组、Subagent 和 Workflow、Branch、Fork、compact、系统消息开关、图片、`tool-results` 按需加载 | 已完成 |
| **M3 找得到** | FTS5 索引、⌘K 搜索和过滤器、命中定位、工具输出扫描、⌘F、`j`/`k`、轮次大纲、复制、在 Finder 中显示 | 已完成 |
| **M4 统计与诊断** | 列表 token 列、统计面板、格式兼容性诊断页 | 已完成 |

## 已知限制

以下问题在验收时识别，因不影响结果正确性而暂缓：

- 同一个 Session 被并发请求（例如实时追随与查找同时进行）时，可能各自重新解析一次文件。
- 每批文件变更都会重新遍历数据目录（真实数据约 60 ms）。
- 某个 Session 的 Main Line 持续计算失败时，该 Session 不建全文索引，搜索浮层会一直提示索引未完成。
- sidecar（`meta.json`、workflow json）比对应转录更新的 Session，每次启动都会重算一次。
- 无斜杠前缀的历史命令记录，标题要等文件重新解析后才会更新。
