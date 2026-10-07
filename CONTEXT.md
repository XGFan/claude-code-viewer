# Claude Viewer

一个只读的 macOS 桌面应用，用来搜索和阅读 Claude Code 在本机留下的历史对话记录。

## Language

**Session**:
一次 Claude Code 对话，以 session ID 为唯一身份；无论它的记录文件在磁盘上出现几份，都只算一个 Session。
_Avoid_: 会话文件, conversation, chat, transcript（指整体时）

**Project**:
Session 所属的工作目录分组，以启动 Session 时的工作目录（解析符号链接后）为身份，而非 `~/.claude/projects/` 下的目录名。
_Avoid_: 项目目录, workspace, folder

**Live Session**:
仍有 Claude Code 进程在运行、可能继续追加内容的 Session；其余 Session 视为已结束。
_Avoid_: 活跃会话, active session, 进行中的会话

**Subagent Run**:
Session 内由一次 Task/Agent 工具调用派生出的子对话；它属于该 Session，不是独立的 Session。
_Avoid_: sidechain, 子会话, agent session

**Workflow Run**:
Session 内由一次 Workflow 工具调用编排的一组 Subagent Run，按阶段组织；它和其中的 Subagent Run 都属于该 Session。
_Avoid_: 工作流会话, pipeline

**Branch**:
同一个 Session 内，用户回退（rewind）或编辑重发后产生的另一条后续路径；它不产生新的 Session ID。
_Avoid_: Fork（Fork 是跨 Session 的）, 版本, 分叉会话

**Main Line**:
Session 中从第一条消息走到最新叶子消息的那条 Branch，即用户在终端里最终看到的对话。
_Avoid_: 主分支, 当前分支, trunk

**Fork**:
从另一个 Session 复制了部分历史后继续进行的新 Session；被复制的那个称为它的 **Origin Session**。
_Avoid_: 分支, 副本, resume（resume 不产生新 Session 时不算 Fork）
