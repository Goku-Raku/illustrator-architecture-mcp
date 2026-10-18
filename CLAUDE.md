# 維護此 alpha

請先讀當前 README 與 AGENT_SETUP；原始上游維護筆記僅保留在 upstream-docs/CLAUDE.md.txt，不能用作本 fork 的發行指令。

- 公開版本為 illustrator-architecture-mcp，保留 MIT 上游署名及第三方授權。來源與素材界線見 ACKNOWLEDGEMENTS、DISCLAIMER、UPSTREAM、PRIVACY、SECURITY。
- 以原始碼和 .tgz 分發；private: true 防止誤發 npm。本版沒有 MCP Registry、MCPB 或 marketplace 發行入口。
- 提交前執行 build、test、verify:offline、verify:package、release:check。GitHub alpha tag 流程只在獲得發布授權後使用；本機提交或驗證不代表已公開發布。
- README 預設繁體中文，同步簡體中文、英文、日文；各語言使用相應的 Illustrator 實機演示圖。不要把四語 README 說成所有方法文件均已翻譯。
- 用戶指定 CC Switch 管理時，先 snapshot，再更新 canonical skill、publish/check；MCP 由經審閱的 JSON 透過管理層 set-mcp。保留各應用啟停、原生 runtime 和認證設定，不中斷正在工作的 agent。
- 同一 Illustrator 文件的操作串行執行；檢查 UUID 可能寫備註。通信結果未知時先復查，不自動重試或假定回滾。
- 未經實機驗證的平台、版本與模擬能力要明示。公開原始碼與安裝包不得含私人設定、研究截圖或測試日誌。
