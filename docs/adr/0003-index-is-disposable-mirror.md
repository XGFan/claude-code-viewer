# 索引是可丢弃的镜像缓存，不是存档

应用的索引只镜像 `~/.claude` 当前的内容：源文件被删除，对应 Session 随之从应用中消失；索引可以随时整体丢弃重建，schema 变化时也直接重建、不写迁移。索引存放在 `~/Library/Caches/` 而不是 `Application Support`，因为对话里常含密钥等敏感内容，Caches 不会进入 Time Machine 备份，并且系统可以在空间不足时回收。

## Considered Options

- **做成存档**（源文件删除后仍保留）：需要完整复制约 3 GB 的对话内容，索引和数据目录都会大幅膨胀；用户已把 `cleanupPeriodDays` 设为 3650，Claude Code 自己基本不会清理，存档的价值不足以抵消这些成本。
