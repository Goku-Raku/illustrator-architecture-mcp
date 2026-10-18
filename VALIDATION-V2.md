# 歷史驗證：architecture.2

> 歷史紀錄，並非目前 alpha 的測試結果或安裝說明。目前版本請見 [alpha 驗證紀錄](docs/VALIDATION-ALPHA.md)。

日期：**2026-10-09（Asia/Taipei）**。版本：`1.10.3-architecture.2`。實機環境：Windows、Adobe Illustrator **26.0.0**。上游較新版本的提示不構成其他環境已通過的證據。

## 自動化與打包

- `npm run build` 通過，產生 ESM 與 `dist/bundle.cjs`。
- 幾何／來源回歸為 **39 個檔案、699 項通過**，文件落盤後另有 **3 項** guidance 測試通過，合計 **702 項**。
- 涵蓋舊 schema 相容、節點、帶符號扇角、整圓無徑向接縫、退化曲線／端切線、控制柄回讀失敗回滾、來源往返與部分更新、固定文件映射及非法路徑拒絕。
- `npm pack --dry-run --json` 確認新工具與 skill 入口、**5 篇參考**及 UI metadata 入包；沒有發布 npm 套件。
- 獨立 stdio 與 bundle 均列出 **6 個**建築工具、讀取 **6 個**指導主題；guidance 不操作 Illustrator。
- skill-creator 驗證、相對連結及 UI YAML 檢查通過。獨立情境試用沒有將欠缺比例／北向的圖書館 JPG 擅轉成氣象、人流或安全證據。

## 當輪 Illustrator 實測

在新建 **1200×900 pt、RGB** 教學文件執行 `demo/architecture-v2-smoke.mjs --draw`：

1. 使用已安裝字型建立 **65 個語義元素、84 個原生部件**，包含五種節點、兩段三次貝塞爾流線、切向箭頭、扇形與時間狀態。
2. 樣式 dry run 回傳 **changed=0**，執行後 **changed=1**；曲線線寬改為 **3.5 pt** 並補寫 `data_ref`。
3. 讀回曲線是可編輯 PathItem，**3 個錨點**及左右控制柄符合座標轉換；來源欄位保留。
4. 保存 AI、匯出 PNG；實際查看後修正扇形文字遮擋、白天門洞及夜間關閉邊界，再檢查最終圖面。

## 研究、歷史安裝與限制

當輪實際查看 **17 張不同 Pinterest 圖像**，研究結果見 [記錄](docs/PINTEREST-RESEARCH.zh-CN.md)。他人圖片未納入 skill 素材或軟體分發包。

當時曾以本機獨立設定更新 MCP 入口、安裝完整 skill 並保留備份。這些步驟發生在 CC Switch 統一管理之前，**不是目前建議的安裝或回退方式**；現行操作請依主 README 與 CC Switch 流程，勿整份覆蓋客戶端設定或製作重複的全域 skill 副本。

教學空間與時段都是合成假設，沒有測繪求解、自動避牆、標籤避讓、複雜孔洞布林或性能模擬。歷史原始 AI、PNG、輸入及日誌留在本機，未納入公開分發。可查看後續公開的 [城市合成教學樣張](examples/urban-demo.png)；它不是本輪 v2 的原始輸出。
