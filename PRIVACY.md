# 隱私說明 / Privacy notice

更新日期：2026-10-18。適用於 `illustrator-architecture-mcp` fork alpha；上游專案的維護者不代表本 fork 接收資料或提供支援。

本伺服器透過本機 stdio 與 MCP 客戶端通訊，使用 Windows PowerShell/COM 或 macOS AppleScript 操作桌面 Adobe Illustrator。本專案未加入遙測、使用分析、崩潰上報或雲端圖像辨識服務。套件安裝及更新可能由套件管理器連線下載依賴，與一般工具執行不同。

## 工具會處理的資料

- **參數與文件內容：** 工具可能讀取或修改目前文件的物件、文字、樣式、圖層與來源註記。回傳內容可能包括文件名稱、檔案路徑、連結圖片路徑、物件資料及畫板預覽。
- **圖片：** `arch_read_reference` 在本機產生 PNG，必要時縮小，再把圖片與座標資訊回傳 MCP 客戶端。伺服器本身不做 OCR 或影像語義辨識。
- **物件備註：** 部分讀取與檢查工具會為缺少識別碼的物件補寫持久 UUID；`arch_inspect_elements` 因此不是完全唯讀。既有備註內容會保留。覆蓋層及樣式工具也可儲存使用者提供的角色、證據與來源欄位，這些資料會隨 Illustrator 文件保存。
- **診斷：** 錯誤與清理警告可能包含本機路徑或主機錯誤訊息，會寫入標準錯誤或工具回應。MCP 客戶端可自行保存這些紀錄。

## 本機檔案與保留

腳本橋接會在作業系統暫存目錄建立 `illustrator-mcp-*` 工作目錄，寫入腳本、參數、啟動程式與結果檔。正常工具結束及程序退出時會嘗試清理。建築預覽另使用 `illustrator-arch-preview-*` 暫存目錄，處理完成後也會嘗試移除。

這是盡力清理，**不是立即刪除或安全抹除保證**。強制終止、程序崩潰、權限問題、檔案鎖定，或逾時後 Illustrator 才寫出結果，都可能留下暫存資料。確認相關程序已結束後，可自行檢查並清理這些目錄；不要刪除仍在使用中的工作檔。

儲存、匯出及示例腳本產生的 AI、PNG、PDF、JSON 或其他輸出會留在對應路徑，供使用者自行管理。即使 PNG 已作為預覽回傳，明確匯出的檔案也不會因此自動刪除。備份、同步軟體及 Illustrator 自己的復原檔另受各軟體管理。

## MCP 客戶端與雲端傳輸

工具結果會交給呼叫它的 MCP 客戶端。客戶端可能將文字、圖片、路徑及工具紀錄傳給模型服務，並保留對話或同步檔案。**本機 MCP 不代表整段工作流程離線**；是否傳送雲端、保存多久、如何刪除，由客戶端設定與其服務政策決定。本伺服器不控制這些選擇，也不代替客戶端提供同意或資料保留設定。

發布問題回報前，請先檢查日誌、畫板預覽及 AI 文件備註是否包含個人或專案資料。本 fork 的支援與漏洞回報方式見 [SECURITY.md](SECURITY.md)；不要把本 fork 的問題直接交給上游維護者。

## English summary

This fork alpha runs as a local stdio server and does not add telemetry or cloud recognition. Tool responses can include artwork, text, object notes, local paths and rendered previews. Some inspection tools persist UUID metadata in Illustrator object notes. Temporary script and preview files are cleaned up on a best-effort basis; crashes, timeouts or cleanup failures can leave files behind. Saved/exported files remain until you manage them. Your MCP client controls whether tool results are sent to cloud services and how conversation or diagnostic data is retained.
