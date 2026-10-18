# 城市小區域範例

![同尺度的日間與夜間路徑比較](urban-demo.zh-TW.png)

四語實機成圖：[繁體中文](urban-demo.zh-TW.png) · [簡體中文](urban-demo.zh-CN.png) · [English](urban-demo.en.png) · [日本語](urban-demo.ja.png)。四張圖均在 Illustrator 中以原生矢量與可編輯文字建立，使用同一座標、尺度與圖層結構。

這是本專案製作的教學範例，並非實際場地調查。兩圖使用同一個 1000 × 600 m 的假設座標範圍，圖面比例為每來源公尺 0.7 pt；近橋關閉後，給定路徑由 495 m 變為 715 m。數字只是所提供直線段長度的加總，沒有路網搜尋、步行時間或交通模擬。

`urban-site-input.json` 包含日間、夜間兩個 `arch_prepare_site_map` 輸入。該工具只準備資料，不操作 Illustrator。真正執行 `arch_add_overlay` 前，必須把 `expected_document.name` 換成經確認的文件名稱，並使用新的 `batch_id`。內院以真正的複合路徑孔洞表達。

原始碼版可執行 `node demo/architecture-v3-site-smoke.mjs` 作離線檢查。加上 `--draw --lang zh-TW`（或 `zh-CN`、`en`、`ja`）會在 Illustrator **新增文件**、繪圖並把帶語言代碼的 AI、PNG 與紀錄寫到本機 `outputs/`。依序執行各語言，不要並行控制 Illustrator。

預設字型為繁中 `MicrosoftJhengHeiRegular`、簡中 `MicrosoftYaHei`、英文 `ArialMT`、日文 `Meiryo`。這些是製作時本機已安裝的字型；本專案沒有單獨分發可安裝字型檔。四語 AI 母版的 PDF 相容部分含有 Illustrator 嵌入的文件字型子集，不能據此視為取得獨立提取、安裝或再分發字型的授權。嵌入核驗與來源說明見[驗證紀錄](../docs/VALIDATION-ALPHA.md)。

編輯母版時，應合法安裝所需字型，或換用具有適當使用權且涵蓋該語言的字型，再檢查字形、行長和預覽。重現腳本可用 `--font` 指定已安裝字型的 PostScript 名稱。程式會拒絕缺字型、缺翻譯或越出畫板安全區的文字，但不能替代視覺檢查。

範例預覽來自 2026-10-18 的 Windows／Illustrator 26.0.0 實機複驗；它不代表 macOS、其他 Illustrator 版本或真實場地資料已通過驗證。舊 `urban-demo.png` 保留為簡中範例相容連結。

Pinterest 研究參考圖未隨套件重新散布；可從研究文件中的原始連結閱讀。
