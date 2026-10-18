# 來源、致謝與使用方式

適用版本：`0.1.0-alpha.2`。來源整理更新：2026-10-18。

本版使用了開源程式碼、建築／城市研究方法、案例文字與分析圖的閱讀筆記。這些來源扮演的角色不同：**沒有把一個建築案例資料庫、GIS 引擎或 Pinterest 圖庫直接整合進 MCP**。以下列出實際使用方式，不以「致謝」暗示合作、背書或取得原圖的再散布權。

## 直接程式碼來源與執行依賴

| 來源 | 本專案的實際使用 | 授權／追溯 |
| --- | --- | --- |
| [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server)；原著作權聲明為 cyocun（IE3） | 本 fork 的直接程式碼基礎；繼承一般 Illustrator 工具、Windows COM／macOS AppleScript 橋接及相關測試 | 上游 1.10.3，基線 `57c5c101a5192c61535493f39b653e6f92b8eb29`；保留 [MIT LICENSE](LICENSE)，變更範圍見 [UPSTREAM](UPSTREAM.md) |
| [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | MCP 伺服器、stdio 傳輸、工具註冊與驗證用客戶端 | `@modelcontextprotocol/sdk`；MIT |
| [Zod](https://github.com/colinhacks/zod) | 工具輸入 schema 與參數驗證 | `zod`；MIT |
| [p-limit](https://github.com/sindresorhus/p-limit) | 腳本執行器內的並行限制 | `p-limit`；MIT；不同伺服器程序之間仍需由呼叫端協調循序操作 |
| [sharp](https://github.com/lovell/sharp) | 預覽影像尺寸處理 | `sharp`；Apache-2.0；不是圖像語義辨識、OCR 或 GIS |

依賴版本與完整關係以 `package.json`、`package-lock.json` 及安裝套件中的授權文件為準。間接依賴與原生二進位元件可能有各自授權；本專案的 MIT 不取代它們。TypeScript、esbuild、Vitest、tsx 與 Node 型別套件用於建置／測試，完整開發依賴亦記錄在套件清單中。

建置會按 bundle 的實際輸入產生 `dist/THIRD-PARTY-NOTICES.txt`，並隨 runtime 套件保留相關第三方授權與通知。原始碼中的 `THIRD_PARTY_NOTICES.md` 另外記錄直接依賴；它不是全部間接依賴的授權彙編。外部安裝的 sharp 與原生相依元件仍須保留各自隨套件提供的授權文件。

新增的建築／城市工具與配套 skill 是本 fork 的擴充。核心幾何轉換由本專案實作；目前沒有將 ArcGIS、QGIS、Rhino、Grasshopper 或建築案例網站作為隱藏的執行依賴，也沒有打包使用者的私人 Obsidian 建築庫。

## 建築與城市方法參考

以下是方法層參照，不是已整合的軟體庫或內附資料集。文件中的「資訊 → 圖形 → 設計動作」表格與教學情境是本專案的整理與轉譯；不能歸為來源機構對使用者專案的判定。

| 來源與可驗證連結 | 實際吸收／轉譯 | 沒有據此宣稱的能力 |
| --- | --- | --- |
| Global Designing Cities Initiative（GDCI），[Measuring and Evaluating Streets](https://globaldesigningcities.org/publication/global-street-design-guide/measuring-evaluating-streets/)、[Measuring the Streets](https://globaldesigningcities.org/publication/global-street-design-guide/measuring-evaluating-streets/measuring-the-streets/) | 將街道的實體／營運變化、使用狀況與較長期結果分開，轉成「現況—設計操作—複測指標」；涵蓋多種使用者與尺度 | 未移植固定斷面尺寸；未內附原書或採用完整評分系統 |
| [Public Life Data Protocol（PLDP）](https://github.com/gehl-institute/pldp) | 分開記錄移動、停留與介面活動，保留觀察時段與資料口徑，避免從地圖臆造人流 | 未捆綁其資料集、調查 app 或完整模板；也不表示本專案已完成公共生活調查 |
| Transport for London，[Healthy Streets](https://tfl.gov.uk/corporate/about-tfl/how-we-work/planning-for-the-future/healthy-streets) | 將過街、休息、遮蔭與不同人的街道體驗列為可核查問題，強調現況與提案比較 | 未導入倫敦政策門檻、正式認證或其試算表評分器 |
| UN-Habitat，[City-wide Public Space Assessment Toolkit](https://unhabitat.org/city-wide-public-space-assessment-toolkit-a-guide-to-community-led-digital-inventory-and-assessment)、[Public Space Site-Specific Assessment](https://unhabitat.org/public-space-site-specific-assessment-guidelines-to-achieve-quality-public-spaces-at-neighbourhood) | 參考公開介紹中城市網絡／分布／可達／數量／品質與片區調查的分工 | 原研究部分網頁／PDF 未能完整讀取；不宣稱完整導入其方法，也不把示例半徑當通用步行服務標準 |
| US EPA，[Measuring Heat Islands](https://www.epa.gov/heatislands/measuring-heat-islands)、[Green Infrastructure and Groundwater Protection](https://www.epa.gov/green-infrastructure/green-infrastructure-and-groundwater-protection) | 分清地表與空氣溫度；把土壤、地下水、污染、滲透及維護列為藍綠策略的條件 | 未附熱環境、地下水或雨洪模擬器，不由綠色塊推定環境效益 |
| UNESCO World Heritage Centre，[Historic Urban Landscape](https://whc.unesco.org/en/faq/260) | 將歷史價值擴展到自然／建成環境、社會實踐、經濟過程與感知關係 | 不提供文化資產認定或保護法規符合性結論 |
| Esri，[服務區](https://pro.arcgis.com/en/pro-app/3.6/help/analysis/networks/service-area-analysis-layer.htm)、[障礙](https://pro.arcgis.com/en/pro-app/3.4/help/analysis/networks/barriers.htm)、[核密度](https://doc.esri.com/en/arcgis-pro/latest/tool-reference/spatial-analyst/how-kernel-density-works.html)、[MAUP](https://support.esri.com/en-us/gis-dictionary/modifiable-areal-unit-problem) | 約束「半徑圓≠路網服務區」、密度估計必須交代參數、改變統計區可能改變結論等方法界線 | 沒有整合 ArcGIS 程式庫、演算法或資料，也不替使用者執行這些計算 |
| US Census Bureau，[Land Area of a Geography](https://www.census.gov/data/what-is-data-census-gov/guidance-for-data-users/frequently-asked-questions/how-can-i-find-the-land-area-of-a-geography.html) | 提醒面積口徑與地理邊界版本需一致；本專案進一步要求明示統計分母 | 沒有載入人口資料，也不能由面積自動推出人口分布 |
| City of Austin Watershed Protection，[Local Flooding](https://www.austintexas.gov/watershed-protection/projects/local-flooding) | 為雨洪圖加入排水系統邊界與下游影響，避免把局部工程當作全系統改善的保證 | 未採用當地設計標準，也未建立本地水理模型 |

PLDP 的來源署名應完整保留：它由 **Gehl Institute、Gehl、City of Copenhagen、City of San Francisco 與 Seattle Department of Transportation** 共同制定。來源庫標示 [CC BY 4.0](https://github.com/gehl-institute/pldp/blob/master/LICENSE)。本專案只將相關觀察原則改寫為中文指引，未重製原始資料表或程式；後續若加入它的材料，應逐項保留來源、授權與改動說明，不以本 fork 的 MIT 覆蓋來源材料。

## 建築案例、檔案與研究文字

| 來源 | 閱讀與使用程度 |
| --- | --- |
| OMA，[Yokohama Masterplan](https://www.oma.com/projects/yokohama-masterplan) | 閱讀官方案例文字，作為市場、交通到達與密度條件的補充參照；不是本專案的幾何模板或效果驗證 |
| Charlotte Malterre-Barthes，[Mapping the Political Economy of Space](https://www.charlottemalterrebarthes.com/research/critical-thinks-seminars/mapping-the-political-economy-of-space/) | 閱讀研究／教學介紹，補足所有權、政策、勞動、管理、維護與使用權的提問 |
| Canadian Centre for Architecture（CCA），[Cedric Price fonds — Generator](https://www.cca.qc.ca/en/archives/380477/cedric-price-fonds/396839/projects/407424/generator) | 閱讀檔案入口，保留為適應性與相容關係的後續研究線索；未聲稱完成原始圖紙的視覺核驗 |
| Studio Weave，[Dalston Town Centre Strategy／Permeability Study](https://www.studioweave.com/projects/dalston-permeability-study) | 閱讀一張公開分析圖，參考通行條件、公共空間與在地機構的對應方式。官方頁列合作團隊包括 Allies and Morrison／Allies and Morrison Urban Practitioners（策略主導）與 Urban Flow（交通規劃）；不把整份研究或全部圖像歸為 Studio Weave 單獨著作 |

上列頁面歸屬與使用程度依研究紀錄及公開來源核對；不是把這些作品、作者或機構加入本專案的貢獻者名單。

## Pinterest 閱圖與素材界線

2026-10-09 的研究記錄包含 **17 張建築分析 Pin、12 張新增城市分析 Pin，以及 1 張上述 Dalston 專案分析圖**。它們被用來觀察小倍圖、圖底、分層、視線、時段、路徑、圖例與證據編碼的表達方式，也記錄了含混、擁擠或可能誤讀的反例。

完整的逐圖連結、閱讀狀態、觀察與限制見：

- [建築分析圖閱圖記錄](docs/PINTEREST-RESEARCH.zh-CN.md)
- [城市分析圖閱圖記錄](docs/URBAN-PINTEREST-RESEARCH.zh-CN.md)
- [轉成 skill 的視覺語法](skills/architecture-diagramming/references/visual-language.md)

Pinterest 是發現入口，Pin 帳號不一定是原作者；圖名與來源身分未能核實時，研究筆記保留該不確定性。公開 alpha 僅保留必要的連結與本專案撰寫的閱讀筆記，**不重新散布這批第三方圖像或研究截圖**，也沒有將它們做成可下載素材庫或執行期訓練資料。新增的[城市範例](examples/README.md)使用合成座標與情境，由本專案工具製作，不複製案例的測量資料。

若後續要重製某張圖、地圖、照片、字型或資料集，必須另外確認原作者、具體授權與所需署名；「公開可見」「附連結」或「曾用作參考」都不會自動擴大本專案對素材的權利。相關使用邊界見 [DISCLAIMER](DISCLAIMER.md)。
