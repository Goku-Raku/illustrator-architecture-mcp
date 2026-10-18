# 0.1.0-alpha.2 驗證紀錄

日期：2026-10-18。這份紀錄區分本機實測、離線協定驗證與尚未驗證的環境。它不是建築性能、工程合規或跨平台相容性認證。

## 已完成的本機驗證

環境：Windows x64、Node.js 24.21.0、Adobe Illustrator 26.0.0。

| 項目 | 結果與範圍 |
| --- | --- |
| 編譯與單元測試 | alpha.2 成功；42 個測試檔、739 項測試通過。包含檢查註記、具體回滾錯誤、通信結果未知、dry run 與 apply 區別、bundle 授權通知收集，以及目錄／檔案符號連結下的實際 CLI 啟動 |
| stdio 離線協定 | ESM／bundle × addon／standalone 四種組合；分別為 7／73 工具，全部 9 個 guidance 主題可讀 |
| 平面資料轉換 | 校準比例、長寬比、來源要素 ID、內院孔洞與錯誤 CRS 拒絕通過；沒有啟動 Illustrator |
| 配套 Skill | canonical 與發行副本共 11 個檔案逐位元組一致；兩處均通過 Skill 格式驗證；含可獨立攜帶的建築／城市方法來源與使用限制 |
| CC Switch 發布 | snapshot → Skill publish/check → reviewed MCP set-mcp/check 完成；9 個 MCP 記錄的管理檢查無問題，Pi 衝突為 0 |
| 用戶端讀回 | Codex、Claude、OpenCode、Pi、OMP 的目標 MCP 入口與環境變數符合審閱定義；資料庫的各應用啟停旗標未變。未重新啟動正在工作的 agent |

### Illustrator 實機：建築元素與樣式

以下繪圖紀錄與四語母版來自同日的 alpha.1 候選；alpha.2 修訂安裝／驗收腳本、測試與文件，未改動繪圖工具實作。這些既有實機證據仍保留其原始範圍。

在新增的 RGB 測試文件執行 `demo/architecture-v2-smoke.mjs --draw`：65 個語義元素、84 個原生組件；曲線、節點、箭頭、扇形、標記、文字及剖線生成成功。樣式 dry run 回報零變更；apply 把指定曲線線寬從 3 pt 改為 3.5 pt，回讀線寬及新增 `data_ref` 成功。另存 AI 並匯出 PNG，實際開啟 PNG 檢查文字、圖層內容與圖面。

### Illustrator 實機：城市小區域

在另一新增文件執行 `demo/architecture-v3-site-smoke.mjs --draw`：兩個地圖批次分別有 21／22 個語義元素。日夜圖共享來源範圍與 0.7 pt/m 轉換；資料準備前後文件資訊相同。內院回讀為 `CompoundPathItem` 與兩個子路徑，預覽可見下方綠色，並非白塊遮蓋。AI 與 PNG 匯出成功，PNG 已逐項閱圖確認。

[公開城市範例](../examples/README.md)包含當次預覽與可攜輸入。495 m／715 m 是合成座標中指定路徑線段的加總，未作 GIS 路網、等時圈或實際場地驗證。原始實機紀錄含本機路徑與文件 ID，留在未分發的本機 `outputs/`。

## 安裝與發行檢查

初始 alpha.1 候選從 Git 暫存區匯出至沒有 `node_modules` 或 `dist` 的獨立目錄，重新執行 `npm ci`、build、完整測試與離線驗證：**全部成功，42 檔／737 項測試通過**。沒有複製開發目錄的依賴。

其後 [遠端候選檢查](https://github.com/Goku-Raku/illustrator-architecture-mcp/actions/runs/39126892240) 發現 macOS 的 `/var` → `/private/var` 符號連結使 CLI 的文字路徑比對失效，產生成功退出但沒有執行的情況。alpha.2 改用真實路徑辨識主入口及套件根目錄，並新增目錄與檔案別名、預設 Node 與 `--preserve-symlinks-main` 下的真實執行回歸：設定須落盤且拒絕覆寫、非法 tag 須失敗、離線四組檢查須有實際完成輸出。修訂後本機完整 **739 項測試通過**；乾淨套件驗證也要求完整的離線結果，不能只接受退出碼 0。保留 alpha.1 的公開 tag，未公開發行該候選的安裝附件。

`verify:package` 成功：封裝允許清單通過，在另一個新建暫存目錄安裝 tarball 的 production 依賴；ESM／bundle、兩種工具模式、9 個 guidance 主題、地圖轉換與兩種設定產生模式均通過。原始碼及 tarball 的檢查都在同一部 Windows 電腦完成，不能稱為另一台電腦的驗收。

發行標籤 `v0.1.0-alpha.2` 的版本與獨立套件身份檢查通過。bundle 隨附 10 個實際內嵌第三方套件的完整授權／通知文本；此處不是對外發布紀錄。

### 四語演示圖

`--draw --lang zh-TW|zh-CN|en|ja` 已分別在 Illustrator 新建文件實測。四語均保持 1600 × 1060 pt 畫板、21／22 個地圖語義元素、兩條內院子路徑及相同 0.7 pt/m 比例；每份包含 **42 個原生可編輯文字框**，全部位於畫板安全範圍，另存 AI／匯出 2000 × 1325 PNG 並實際閱圖。語言預設字型及重現方法見 [examples](../examples/README.md)。README 已各自使用對應語言預覽；沒有單獨分發可安裝字型檔，AI 的 PDF 相容部分則含有文件嵌入子集。

2026-10-18 發布前只讀檢查四份 AI：PDF 相容資料均具有 `/FontFile` 參照及帶子集前綴的字型名稱，分別對應 `ArialMT`、`Meiryo`、`MicrosoftYaHei`、`MicrosoftJhengHeiRegular`。另讀取製作機器上的 `arial.ttf`、`meiryo.ttc`、`msyh.ttc`、`msjh.ttc`，其所有字型項目的 OS/2 `fsType` 均為 `8`（Editable Embedding），沒有 restricted embedding 或 no-subsetting 標記。這是本次本機字型檔的技術記錄，不代表其他版本或取得方式的授權已獲核實。

[Microsoft 官方 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq) 說明，文件嵌入須遵守字型內的權限旗標及軟體的相關限制，與單獨再分發字型不同。本次檢查沒有授予額外字型權利，也不是法律保證。母版編輯應使用合法安裝的字型，或替換為具有適當使用權的字型後重新檢查排版。

原始碼重現：

```sh
npm ci
npm run build
npm test
npm run verify:offline
npm run verify:package
npm run release:check -- v0.1.0-alpha.2
```

`verify:package` 檢查允許的封裝檔案，在獨立暫存目錄安裝 runtime 依賴，並從安裝後的套件執行離線驗證與兩種模式的設定產生器；不複製開發目錄的 `node_modules`。依賴安裝需要 registry 或已有快取。

## 未驗證與不可推論的事項

- macOS、其他 Illustrator 版本的實際應用程式連線、字型、渲染與輸出尚未驗證。Linux 僅可測離線部分，沒有本專案提供的 Linux Illustrator bridge。
- CI 配置 Windows／macOS／Linux × Node 22／24。此處保留本機驗證證據；遠端結果須核對 [GitHub Actions](https://github.com/Goku-Raku/illustrator-architecture-mcp/actions/workflows/ci.yml) 中對應 commit／tag 的實際執行。設定 CI 不等於矩陣已通過，離線 CI 通過也不等於該平台的 Illustrator 實機驗證。
- `outcome_unknown` 的通信異常處理有單元測試；沒有以強制崩潰 Illustrator 的方式測試所有真實中斷情境。超時不證明原操作已停止，不能自動重試。
- 檢查工具可能持久化 UUID 至物件備註；所有連到同一 Illustrator 的客戶端仍須串行操作。有限的實機範例不覆蓋全部 66 項上游工具或所有第三方文件。
- 方法與範例未取得建築、規劃、消防、無障礙、結構或環境模擬認證。完整邊界見 [DISCLAIMER](../DISCLAIMER.md)、[PRIVACY](../PRIVACY.md) 與 [SECURITY](../SECURITY.md)。

歷史紀錄：[v1](../VALIDATION.md)、[v2](../VALIDATION-V2.md)、[v3](../VALIDATION-V3.md)；歷史測試數不可與本版混用。
