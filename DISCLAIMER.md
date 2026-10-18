# 使用邊界與免責說明

適用於 `illustrator-architecture-mcp 0.1.0-alpha.1`；更新日期：2026-10-18。本說明描述目前能力、資料與操作風險，不改寫 [MIT LICENSE](LICENSE)，也不賦予第三方內容額外權利。來源與轉譯方式見 [ACKNOWLEDGEMENTS](ACKNOWLEDGEMENTS.md)，程式碼沿革見 [UPSTREAM](UPSTREAM.md)。

## 1. 用途與專業判斷

本工具用於建築／城市分析圖的研究、策劃、編輯與表達。它不是經認證的測量、GIS、交通、熱環境、日照、水文、結構、消防、無障礙或法規審查系統；配套 skill 也不是專業資格或機構認證。圖紙生成成功、測試通過或內建預檢未報錯，不代表方案可施工、依法合規、服務公平或性能達標。

實際工程、公共決策、審批與交付應使用適用地區的可靠資料、必要專業計算與負責人審查。參考文件提到的城市案例、研究工具或外地指標，需要依專案條件重新判斷，不能直接移植為當地標準。這不是承諾任何機構會接受本工具的成果。

## 2. 證據、模型與圖形不等同

- AI 對文字、圖像與空間關係的判斷可能錯誤。請區分直接觀察、使用者提供資料、推斷與提案，保留來源、日期、未知與驗證方式。
- `arch_prepare_site_map` 只把已明確定義的投影／本地平面座標轉成 Illustrator 覆蓋參數。它不抓取底圖、不重投影、不驗證現地幾何真實性，也不計算路網等時圈、人口密度、水文或環境性能。
- 底圖像素配準不是實際尺度校準；區域填色不是土地權屬認定；節點、箭頭、扇形與線寬不是人流、可視性或性能測量。缺少北向、尺度、資料口徑或開放時段時，應明確標示未知。
- 參考圖上的數字、色塊、界線與圖例不自動屬於使用者專案。公開示範採用合成資料，不能作為真實場地證據；其簡單路徑長度也不等於路網搜尋或步行時間。
- 方法指引主要以簡體中文提供；四語 README 的同步不代表所有參考文件均有四語翻譯。

## 3. Alpha 與平台驗證邊界

此為 alpha，API、輸入限制、安裝流程和文件仍可能變動。版本更新前應保留可用的套件、設定與文件備份，核對變更後再在副本或新文件驗收。

目前本 fork 的實機證據來自 Windows／Illustrator 26。macOS 橋接雖繼承自上游，仍未完成本 alpha 的實機驗收；其他 Illustrator 版本與不同字型／色彩／外掛環境亦不因現有測試而自動獲得保證。宣告的 Node 主版本與 CI 配置，不能當作某次跨平台 CI 已成功執行的證據。實際完成、歷史證據及未驗項目以 [VALIDATION-ALPHA](docs/VALIDATION-ALPHA.md) 的分項記錄為準。

離線測試會檢查程式、schema、guidance 與合成資料轉換；乾淨安裝測試會檢查封裝及依賴。兩者都不能替代 Illustrator 的實際圖面、原生物件、字型與匯出驗收。

## 4. 文件變更與失敗恢復

本地 MCP 具備讀取及修改 Illustrator 文件、儲存與匯出的能力。使用前先確認目標文件身分；重要文件保留備份，優先在新圖層或副本上完成小規模驗收，再擴大操作。

`arch_inspect_elements` 及部分繼承的讀取工具可能為物件補寫持久 ID 到備註，因此不能把「檢查」一律視為無修改。語義、來源與證據欄位也可能隨 AI 文件保存。樣式預檢只描述當時狀態；執行前後若有其他程式、人員或 agent 修改文件，結果可能不同。

同一 Illustrator 可能同時被基本伺服器、此 fork 和使用者操作。**跨伺服器的應用程式操作必須循序協調**；單一程序的執行佇列不會鎖住其他程序，也無法防止文件或選取在外部改變。

通訊逾時、中斷或原生介面失敗時，Illustrator 可能尚未執行、已部分執行、已完成，或仍在處理。若回傳 `outcome_unknown:true`，先讀回文件、圖層與批次／物件狀態，待結果明確後再決定恢復動作。不要盲目重試寫入、重複提交同一批次或反覆全域復原。局部回滾及暫存清理都是有限範圍、盡力處理，不是跨程序交易、完整備份或安全抹除的保證。

## 5. 地圖、圖片、字型、資料與第三方權利

本專案的程式碼授權不涵蓋使用者匯入的底圖、照片、建築圖紙、字型、地籍、統計資料或其他第三方內容。公開可閱、附來源連結、可下載或可供研究，都不自動代表可以重製、再授權、商用、公開散布或嵌入字型。使用與分享前，應確認各項材料的權利、署名、來源與用途條件。

四語示範沒有單獨分發可安裝字型檔；AI 母版的 PDF 相容部分含有 Illustrator 嵌入的文件字型子集。這些子集不屬於本專案可重新授權的字型資產，也不授予獨立提取、安裝或再分發字型的權利。編輯時應合法安裝所需字型，或替換為具有適當使用權的字型並重新核對圖面。文件嵌入規則與本次檔案檢查見 [Microsoft 字型 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq) 及[驗證紀錄](docs/VALIDATION-ALPHA.md)；核驗結果不是對所有字型版本、軟體授權或再利用方式的法律保證。

Pinterest 用於發現及閱讀參考圖；Pin 發布者不一定是原作者。本 fork 不重新散布研究用的第三方圖像截圖，不宣稱擁有被參考作品。若用戶自行加入地圖、資料或照片，需自行保留其出處與使用限制；涉及可識別人物、住宅位置或其他敏感資料時，也應依專案的保護需求處理。

Adobe Illustrator、Adobe、其他產品及機構名稱用於辨識所需軟體或研究來源。本 fork 不是 Adobe 官方產品，也未宣稱獲得上游作者、Pinterest 或被引用機構的認證、贊助或背書。使用 Illustrator 與字型所需的軟體／內容權利由各自供應方提供，本套件不提供這些授權。

## 6. 本機執行與資料傳送

此 MCP 的腳本橋接在本機運作，不代表整段 AI 工作流程離線。工具結果可能包含文件內容、文字、物件備註、圖片預覽與檔案路徑；MCP 客戶端可能把它們交給模型服務、保留對話或同步。請依用戶端設定及專案的資料要求決定使用範圍。完整處理方式、暫存保留與清理限制見 [PRIVACY](PRIVACY.md)。

問題回報與安全通報可能附帶日誌或範例文件，公開前應移除不應分享的資料。回報途徑與目前限制見 [SECURITY](SECURITY.md)；本 fork 的問題不應自動轉交上游維護者。

## English summary

This alpha supports diagram planning and editable Illustrator artwork. It is not a certified surveying, GIS, engineering, accessibility, code-compliance, or performance-assessment system. AI interpretations and synthetic examples are not project evidence. Planar coordinate conversion does not perform reprojection, network analysis, or environmental simulation; professional decisions require appropriate project data and review.

Live-app evidence is limited to Windows and Illustrator 26. Offline tests and configured CI jobs do not establish live compatibility on other platforms. Back up important files, confirm the active document, and serialize operations across servers. Some inspection tools persist object IDs in notes. After `outcome_unknown:true`, inspect the actual document and batch/object state before deciding whether to retry or recover; rollback is not a cross-process transaction guarantee.

Third-party maps, images, fonts, and datasets retain their own rights and conditions. Pinterest references are research links, not a redistributed asset library. This fork is not an official Adobe product and does not imply endorsement by cited authors or institutions. A local MCP may still return content to a cloud-connected client; see [Privacy](PRIVACY.md) and [Security](SECURITY.md). The [MIT license](LICENSE) remains the software license; this notice does not extend rights to third-party materials.

The four-language demos do not separately distribute installable font files. Their AI masters contain document-embedded font subsets in the PDF-compatible portion; these do not grant standalone font extraction, installation, or redistribution rights. To edit the masters, use lawfully installed fonts or suitable licensed replacements and recheck the artwork. The recorded embedding checks are limited to the files examined and do not constitute a general licensing guarantee.
