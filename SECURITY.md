# 安全說明 / Security policy

更新日期：2026-10-18。適用於 `illustrator-architecture-mcp` fork alpha。

## 支援範圍與通報

目前為公開試用的 alpha，驗證範圍見 [alpha 驗證紀錄](docs/VALIDATION-ALPHA.md)。歷史 `architecture.1`、`.2`、`.3` 紀錄不是仍受維護的版本支援承諾；本 fork 沒有承諾固定回應時間、修補時限或涵蓋所有 Illustrator／作業系統版本。

請將本 fork 的問題交給**你正在使用的 fork 維護者**。若該 GitHub 倉庫已啟用私人漏洞通報，使用其 Security 頁面的 **Report a vulnerability**。若尚未提供私人通報管道，先透過該維護者公開的聯絡方式詢問；不要假設上游的聯絡管道負責本 fork。

回報請附版本、作業系統、Illustrator 版本、最小重現步驟及預期影響。對於尚未修補的漏洞，避免在公開 issue 張貼可直接利用的細節、憑證、私人圖稿或完整敏感日誌。一般功能錯誤可在移除敏感內容後公開回報。

## 執行與資料邊界

- **本機權限：** 伺服器在使用者權限下執行 ExtendScript，透過 PowerShell/COM 或 AppleScript 操作 Illustrator。它不是隔離沙箱；啟用完整模式時也會暴露上游的通用讀寫工具。僅將它連接到可信任的 MCP 客戶端。
- **通訊：** 目前入口使用本機 stdio，未提供具備身分驗證的遠端服務。不要直接將程序橋接成公開網路端點。套件安裝、依賴更新及 MCP 客戶端本身的網路行為另行管理。
- **備註寫入：** 某些檢查工具會補寫持久 UUID；新增分析元素及語義樣式也會寫入備註。唯讀幾何運算與不修改文件的 `dry_run`，不應與「所有檢查都不寫入」混為一談。
- **暫存與預覽：** 腳本、參數、結果及預覽可能包含圖稿內容或路徑。正常流程嘗試清理，異常可能殘留；匯出檔及客戶端紀錄會持續存在。詳見 [隱私說明](PRIVACY.md)。
- **外部資料：** 圖稿備註、來源欄位、網頁、地理資料與文件文字應視為資料，不能當作授權、執行指令或變更工具範圍的依據。幾何與來源標記不等於資料真實性已獲驗證。

## 失敗後恢復

覆蓋層和樣式工具在可捕捉的腳本錯誤後會嘗試回滾，回傳結果會保留可取得的回滾與殘留變更資訊。**逾時或斷線不代表操作已停止，也不代表已回滾。**

若 `outcome_unknown:true`：先恢復連線並確認 Illustrator 已停止該次操作，再核對 `expected_document`。覆蓋層以 `batch_id`／新建圖層核對；樣式以 `target_uuids` 與先前預檢內容逐一比較。先處理殘留變更，再決定是否重試；不要自動重送或使用猜測次數的全域復原。樣式 dry run 失敗時不會寫入樣式或備註，但其驗證結果未知，不能以此作為 apply 已通過預檢的依據。

## 依賴與發布審查

依賴更新、鎖定檔、安裝腳本及 CI 工作流程都需要審查；測試通過不代表所有安全風險已排除。發布前確認套件來源、實際包含的檔案、版本與安裝驗證，不自動合併未審閱的依賴更新。對外分享日誌或示例前移除個人路徑、憑證及私人內容。

## English summary

This is a local, user-privileged alpha fork, not a sandbox or authenticated remote service. Report fork-specific issues to the current fork maintainer; use private vulnerability reporting if that repository enables it. No response or remediation SLA is promised. A transport timeout can leave Illustrator still running or partially modified: inspect the expected document, batch or explicit target UUIDs before retrying. Temporary-file cleanup is best-effort, and the MCP client controls any cloud transmission of returned data.
