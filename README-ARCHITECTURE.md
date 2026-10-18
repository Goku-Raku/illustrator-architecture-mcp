# 建築與城市分析技術說明

`illustrator-architecture-mcp` 是基於 [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server) 的 MIT 授權 fork alpha。上游起始基線為 `57c5c101a5192c61535493f39b653e6f92b8eb29`（1.10.3）。安裝與版本資訊以 [主 README](README.md) 為準，實際驗證範圍見 [alpha 驗證紀錄](docs/VALIDATION-ALPHA.md)。

本擴充將「讀取底圖 → 座標配準 → 有來源的可編輯覆蓋層 → 精確調整 → 預覽復核」接成一組工具。配套 [architecture-diagramming skill](skills/architecture-diagramming/SKILL.md) 負責分析問題、證據、圖形編碼與設計動作；工具不代替 GIS、環境模擬、測繪或建築判斷。

| 工具 | 技術用途 |
| --- | --- |
| `arch_read_reference` | 回傳畫板／局部 PNG、文件身分、圖片資訊與座標框；可能補寫缺失 UUID |
| `arch_map_preview_points` | 將原始預覽像素換成畫板左上角原點、Y 向下的 pt 座標 |
| `arch_prepare_site_map` | 將明確宣告 CRS、單位、Y 方向的平面要素等比轉成覆蓋參數；保留來源 ID 與孔洞，不連接 Illustrator |
| `arch_add_overlay` | 新建獨立圖層，產生區域、真實孔洞、折線／貝塞爾流線、箭頭、節點、扇形、邊界、文字及斜線填充 |
| `arch_inspect_elements` | 讀取樣式、語義、保護狀態與路徑點；缺失 UUID 會寫入備註，因此是非破壞的冪等中繼資料寫入 |
| `arch_style_elements` | 對明確 UUID 的路徑／文字預檢、套用樣式與語義，執行後回讀；`dry_run` 預設為 `true` |
| `arch_get_diagram_guidance` | 從隨包附帶的固定文件讀取方法、圖譜、案例與工具邊界，不需 Illustrator |

`ILLUSTRATOR_ARCHITECTURE_ONLY=1` 僅暴露 7 個專用工具，適合搭配既有通用 Illustrator MCP。完整模式另外提供上游通用工具。所有連到同一 Illustrator 的應用操作都應依序執行。

## 座標、證據與恢復

預覽像素須使用實際回傳尺寸換算，不能使用聊天縮圖尺寸。配準只代表畫板定位；真實距離、面積、北向與比例尺仍需資料。底圖或畫板移動後重新取圖與配準。城市工具接受明確的投影／本地平面座標，不下載地圖、不重投影，也不計算路網、等時圈或密度。

每個分析元素可保存 `role`、`evidence` 及 `observed`／`inferred`／`proposed`／`supplied` 證據類別，另附 `source_ref`、`data_ref`。工具保存這些敘述，不驗證其真實性。PNG/JPG 仍是像素；本擴充不提供 OCR、房間分割或圖片轉 CAD。

覆蓋層拒絕重複 `batch_id`；樣式編輯拒絕含糊 UUID、群組、位圖、複合路徑成員及鎖定／隱藏等受保護目標。可捕捉錯誤會嘗試回滾；通信失敗可能回傳 `outcome_unknown:true`。此時確認操作已結束，再核對文件、批次或 `target_uuids`，不能假設沒有修改或直接重試。詳見 [工作流程](ARCHITECTURE-WORKFLOWS.md) 與 [安全說明](SECURITY.md)。

閱讀入口：[建築方法](docs/DIAGRAM-METHODOLOGY.zh-CN.md)、[城市 site analysis](docs/URBAN-SITE-ANALYSIS.zh-CN.md)、[完整 skill](skills/architecture-diagramming/SKILL.md)。公開的 [城市教學樣張](examples/urban-demo.png) 使用合成資料；歷史實機紀錄見 [v1](VALIDATION.md)、[v2](VALIDATION-V2.md)、[v3](VALIDATION-V3.md)，不代表本 alpha 在所有平台的支援保證。
