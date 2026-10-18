# MCP 與 architecture-diagramming skill 配對安裝

[繁體中文 README](README.md) · [简体中文](README.zh-CN.md) · [English](README.en.md) · [日本語](README.ja.md)

本指南適用於 `illustrator-architecture-mcp 0.1.0-alpha.1`。公開安裝入口是本 fork 的原始碼或本機 `.tgz`，不是上游 npm 套件、Claude 外掛或 MCPB。以下所有範例路徑都要以安裝機器的實際路徑替換；不要沿用其他電腦的路徑。

MCP 負責與 Illustrator 通訊及提供工具。`architecture-diagramming` skill 負責選擇分析問題、查驗資料、圖形編碼與完成檢查。README 不是自動載入的 agent 指令，MCP 的啟用也不會自動安裝 skill。即使沒有安裝 skill，`arch_get_diagram_guidance` 仍可讀取隨 MCP 附帶的同一組方法參考。

## 1. 準備執行環境

需要 Node.js **22 或 24** 與 npm。先在終端執行 `node --version` 和 `npm --version` 確認使用的執行檔。桌面程式啟動時的 PATH 可能與終端不同；後面的設定產生器會記錄目前 Node 的絕對路徑，避免依賴 PATH。

原始碼安裝：下載此 fork，進入其目錄後執行：

```sh
npm ci
npm run build
npm test
npm run verify:offline
```

本機 `.tgz` 安裝：建立新的安裝目錄，進入後執行：

```sh
npm init -y
npm install --omit=dev /absolute/path/illustrator-architecture-mcp-0.1.0-alpha.1.tgz
node node_modules/illustrator-architecture-mcp/scripts/verify-offline.mjs
```

依賴安裝需要 npm registry 或已有快取。`verify:offline` 本身不啟動、不讀取、也不更動 Illustrator。它檢查 ESM 與 bundle、兩種模式的工具列表、9 個 guidance 主題及平面地圖資料轉換。不要以「連線成功」代替這些檢查。

執行目錄必須一起保留 `package.json`、完整 `dist/`、正式依賴，以及 `skills/architecture-diagramming/`。只有 `dist/index.js` 不夠；guidance 使用執行目錄內附帶的參考文件。安裝到 agent 的 skill 也不能代替 MCP 的這份執行資源。兩者分別是**套件內固定版本的資源**與**CC Switch 管理的共用 skill**，不是兩套 agent 技能維護來源。

## 2. 選擇一種伺服器模式

| 模式 | 環境變數 | 基礎 Illustrator 操作 |
| --- | --- | --- |
| `standalone` | `ILLUSTRATOR_ARCHITECTURE_ONLY=0` 或省略 | 此 fork 提供全部 73 個工具：上游 66 個及新增 7 個 |
| `addon` | `ILLUSTRATOR_ARCHITECTURE_ONLY=1` | 此 fork 僅提供 7 個新增工具；既有基本伺服器繼續負責開檔、儲存、匯出等 |

這是此 alpha 的工具數量，未來版本以實際 discovery schema 為準。預設是 `standalone`。若已有基本 Illustrator MCP，通常選 `addon`，保留原本啟用狀態；若改選 `standalone`，應有意識地停用重複的基本入口，不擅自改變其他用戶端的選擇。兩個伺服器指向相同 Illustrator 時，應跨伺服器循序執行應用程式操作。

## 3. 產生並審閱 MCP 定義

在原始碼目錄中，選擇需要的模式並產生新檔案：

```sh
npm run config:generate -- --mode addon --output illustrator-architecture.server.json
```

若從 `.tgz` 安裝，在安裝資料夾執行：

```sh
node node_modules/illustrator-architecture-mcp/scripts/generate-config.mjs --mode addon --output illustrator-architecture.server.json
```

沒有基本伺服器時，將兩者的 `addon` 改成 `standalone`。產生器會解析本機 Node 與套件入口的絕對路徑，輸出**單一伺服器物件**；不是包住整份設定的 `mcpServers` 物件。它不修改 CC Switch 資料庫或任何用戶端設定，也拒絕覆寫同名檔案。若要再次產生，使用不同的新檔名。

審閱項目：

- `command` 是否指向可用的 Node 22／24，`args` 是否指向本 fork 的 `dist/index.js`。
- `ILLUSTRATOR_ARCHITECTURE_ONLY` 是否符合選定模式。
- 更新既有條目時，合併保留原有的必要環境變數、啟動／工具逾時與用戶端選項，避免用最小範例沖掉它們；不更改 provider、認證或模型設定。
- 不把生成檔案中的本機路徑提交到公開儲存庫。

若安裝位置改變、Node 升級後路徑改變，應重新產生定義並依同一管理流程更新。

## 4. CC Switch 管理環境

使用者已選擇 CC Switch 為管理來源的環境，所有共用 skill 與 MCP 定義都應經過它發布。下列 `manage.mjs`／`manage.ps1` 是部署者提供的管理腳本；**本套件不附帶，也不將其宣稱為所有 CC Switch 版本的內建功能**。先確認該環境自己的管理腳本位置，不使用本專案作者的個人路徑。

Windows PowerShell 範例（先將 `managerDir` 改為已部署的管理目錄）：

```powershell
$managerDir = 'C:\path\to\cc-switch-management'
node "$managerDir\manage.mjs" snapshot
```

必須在修改受管理 skill 或 MCP 之前完成 snapshot。備份應放在 skill 探索目錄外，避免舊版本被重複載入。

### 發布 skill

1. 以安裝包內完整的 `skills/architecture-diagramming/` 為本版來源，與目前共用 skill 比對；已有本地修改時先合併。
2. 更新唯一維護位置 `~/.cc-switch/skills/architecture-diagramming/`。保留 `SKILL.md`、`references/`、`agents/` 等完整結構，不只複製主文件。
3. 由管理腳本發布、檢查：

```powershell
& "$managerDir\manage.ps1" -Action publish
& "$managerDir\manage.ps1" -Action check
```

用戶端的技能資料夾應連結到共用目錄；**不要在全域 `.agents/skills` 建立另一份副本**。不要改動 Codex 自帶或外掛提供的 skill。檢查報告需要包括 Pi 的 skill 名稱衝突、連結目標與各用戶端投影狀態；有衝突先處理清楚，不額外啟用使用者原本停用的項目。

### 發布 MCP

在確認 JSON 中原有的必要執行設定已保留後，透過 CC Switch 資料庫發布：

```powershell
$specFile = (Resolve-Path -LiteralPath '.\illustrator-architecture.server.json').Path
& "$managerDir\manage.ps1" -Action set-mcp -McpId illustrator_architecture -SpecFile $specFile
& "$managerDir\manage.ps1" -Action check
```

`illustrator_architecture` 是條目名稱範例；更新既有安裝時使用原本 ID，避免多建立一份。`set-mcp` 會先備份再發布。保留每個用戶端的啟用／停用選擇及原生執行值，尤其是 Codex 的 `node_repl`；不更改其他 MCP、provider、認證或模型設定。

發布後讀回各用戶端的**實際相關條目**，核對 Node、入口、環境變數、逾時和啟用狀態；不要只看暫存 JSON 就宣稱發布完成。檢查設定時不應在公開紀錄中輸出其他條目的憑證。

## 5. 非 CC Switch 管理環境

本節僅適用於沒有指定 CC Switch 為管理來源的安裝。透過用戶端支援的機制合併設定，保留其他條目。JSON 類型的用戶端常需要外層 `mcpServers`，例如：

```json
{
  "mcpServers": {
    "illustrator_architecture": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/illustrator-architecture-mcp/dist/index.js"],
      "env": {
        "ILLUSTRATOR_ARCHITECTURE_ONLY": "0"
      }
    }
  }
}
```

請以產生器取得的本機 `command`、`args`、`env` 取代範例，不要把上面的假路徑直接投入使用。Windows JSON 中的反斜線需跳脫；產生器已處理這件事。

Codex 的對應 TOML 結構為：

```toml
[mcp_servers.illustrator_architecture]
command = '/absolute/path/to/node'
args = ['/absolute/path/to/illustrator-architecture-mcp/dist/index.js']

[mcp_servers.illustrator_architecture.env]
ILLUSTRATOR_ARCHITECTURE_ONLY = '0'
```

用戶端會加入自己的工具名稱前綴，應使用 discovery 回傳的確切工具名稱與 schema；不要硬編 `mcp__...` 前綴。安裝完整 `architecture-diagramming/` 到該用戶端支援的技能探索位置，或透過其支援方式明確載入 skill。可參考 [Codex 官方 MCP 文件](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)及 [Skills 文件](https://learn.chatgpt.com/docs/build-skills)。`agents/openai.yaml` 是 host metadata，不代表所有其他 agent 都會自動辨識。

## 6. 分兩階段驗收

### 不啟動 Illustrator 的檢查

- `verify:offline` 成功，7 個 `arch_` 工具都能 discovery；`standalone` 同時包含基礎工具。
- `arch_get_diagram_guidance` 的 `overview`、`mcp_execution`、`urban_site` 等主題可讀；完整測試涵蓋全部 9 個主題。
- skill 的相對參考文件存在；受管理安裝的客戶端連結指向 canonical 共用目錄。
- 用戶端實際載入的 MCP 定義與審閱內容一致。應用程式相關讀取工具可能啟動或切換 Illustrator，因此不屬於這個階段。

從原始碼安裝的維護者還可執行 `npm run verify:package`：它檢查封裝內容，在乾淨暫存目錄安裝正式相依套件，然後執行離線驗證；可能需要網路或快取。這是乾淨套件安裝檢查，不是另一台電腦或 macOS 的實機驗證。

### 實際繪圖的驗收

確認使用者要進行繪圖且允許操作應用程式後：

1. 開啟測試用新文件或明確指定的文件，讀取文件身分與真實預覽。
2. 用一個已知參照點核對座標，建立少量可編輯元素到獨立新圖層。
3. 檢查原生物件、語義、孔洞與來源資料；`arch_inspect_elements` 可能補寫物件 ID 備註，並非純唯讀操作。
4. 先預檢樣式變更，再執行並讀回；重新看預覽，核對配準、文字、透明度與圖例。
5. 按已授權範圍另存 AI／匯出預覽，記錄作業系統、Node 及 Illustrator 版本。

Windows／Illustrator 26 的既有實機證據與本 alpha 的當次檢查記錄在 [VALIDATION-ALPHA](docs/VALIDATION-ALPHA.md)。其他環境仍須各自驗收，不能用離線通過推論跨平台作圖已驗證。

## 7. 更新、復原與常見問題

- **更新 MCP 程式碼：**重新安裝該平台的依賴、建置並執行離線與套件檢查；保持 runtime 與 bundled guidance 版本相配。更新共用 skill 時仍先 snapshot，再 publish／check。
- **尚未看見新增工具或新 skill：**在工作告一段落後重新連接 MCP 或重新載入 skill；不要自動重新啟動正在工作的 agent。
- **找不到 guidance：**確認完整 `skills/architecture-diagramming/` 跟隨 runtime 安裝；不只保留 agent 的技能連結。
- **桌面端找不到 Node：**檢查實際載入設定的 `command`，不要只測試終端中的 `node`。
- **重複工具：**檢查是否同時啟用完整 fork 與基本伺服器；選好模式後，僅調整預期用戶端的重複入口。
- **逾時或通訊中斷：**若 `outcome_unknown:true`，先檢查文件、圖層、批次／物件狀態，再決定下一步。不得盲目重試寫入或反覆全域復原。
- **需要回復先前版本：**使用 snapshot 與先前套件恢復對應 skill／MCP 定義，透過同一管理層發布並讀回；保留各用戶端原有啟用選擇。文件內容的回復需另按實際物件狀態判斷，不等於設定回復。

## 8. 來源、權利與使用說明

安裝與發布前，請閱讀[來源與致謝](ACKNOWLEDGEMENTS.md)、[使用邊界與免責說明](DISCLAIMER.md)、[上游沿革](UPSTREAM.md)、[隱私說明](PRIVACY.md)及[安全回報](SECURITY.md)。方法參考不是已整合的建築資料庫或 GIS 引擎；本套件的 MIT 授權不替使用者取得 Illustrator、字型、地圖、圖片或資料集的使用權。公開分享範例、設定或日誌時，檢查第三方材料與專案資料的權利及保護要求。
