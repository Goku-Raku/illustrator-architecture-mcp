# Illustrator Architecture MCP 0.1.0-alpha.2

本版修復 macOS 符號連結路徑（例如 `/var` 對應 `/private/var`）造成命令列入口辨識失效，讓設定產生與離線驗收腳本靜默跳過、卻回傳成功狀態的問題，並加入回歸檢查。`0.1.0-alpha.1` 是被跨平台 CI 攔截的發行候選：保留既有 tag，不改寫歷史；未公開發行安裝包。本版 `0.1.0-alpha.2` 接續首次公開發行。

首個可公開分發的 alpha：建築與城市小區域分析方法、七個專用工具、同尺度平面資料轉換、來源與證據註記、真實內院孔洞、精確樣式預檢及回讀。

本版補齊 UUID 元資料寫入的工具聲明、通信中斷的未知結果回報與恢復指引。採獨立發行身份、原始碼與 `.tgz` 安裝；新增乾淨安裝及雙入口／雙模式離線驗證，退役上游安裝器身份。預設 README 為繁體中文，同步簡體中文、英文、日語；Skill 與 MCP 分開安裝，CC Switch 使用單一管理來源。

公開 fork：[Goku-Raku/illustrator-architecture-mcp](https://github.com/Goku-Raku/illustrator-architecture-mcp)。本版採 [GitHub 預發行版本](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/tag/v0.1.0-alpha.2) 散布，未上架 npm、MCP Registry 或外掛市集；`private: true` 僅防止意外發佈至 npm。

下載內容：

- [本機安裝包 `.tgz`](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/download/v0.1.0-alpha.2/illustrator-architecture-mcp-0.1.0-alpha.2.tgz)。
- [原始碼 ZIP](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/download/v0.1.0-alpha.2/illustrator-architecture-mcp-0.1.0-alpha.2-source.zip)。
- [四語 AI 母版與 PNG ZIP](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/download/v0.1.0-alpha.2/illustrator-architecture-demo-masters-four-languages.zip)：繁體中文、簡體中文、英文、日語，均在 Illustrator 中製作，向量與文字可編輯；不單獨提供可安裝字型，AI 的 PDF 相容部分含文件嵌入子集。編輯時須合法安裝相應字型或替換後複核。
- [SHA-256 校驗碼](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/download/v0.1.0-alpha.2/SHA256SUMS.txt)。

四語 README 說明參考圖拆解與風格復現的工作流程：觀察、資訊與圖形映射、樣式規格、製作與對照修正。現有實機證據為四語向量演示，尚未系統驗證任意 Pinterest 圖的復現。複雜三維幾何、照片與紋理仍需相應模型或素材；不由圖片補造隱藏資料。

範圍與當次驗證見 [alpha 紀錄](docs/VALIDATION-ALPHA.md)；來源見 [致謝](ACKNOWLEDGEMENTS.md)與 [上游](UPSTREAM.md)，使用邊界見 [免責與使用限制](DISCLAIMER.md)。離線檢查與 Illustrator 實機驗證分開記錄；此處不宣稱所有平台的遠端 CI 或實機測試均已通過。

---

以下保留上游發行記錄，並非本 alpha 的測試聲明。

## Upstream history: What's New / 新機能

- **Auto-generated export paths** — When `output_path` is omitted in `export`, `export_pdf`, or `save_document` (save_as), the file is saved to the document's directory (or ~/Desktop for unsaved documents) with collision-safe numbering.
- **書き出しパス自動生成** — `export`、`export_pdf`、`save_document`(save_as)で`output_path`を省略すると、ドキュメントと同じディレクトリ（未保存時は~/Desktop）に連番付きで自動保存。

## Bug Fixes / バグ修正

- Fixed SVG export verification failure when Illustrator appends artboard name to filename.
- Fixed non-ASCII filenames triggering a warning dialog during SVG export (auto-fallback to ASCII name).
- SVG書き出し時、Illustratorがアートボード名をファイル名に付加する挙動で検証が失敗する問題を修正。
- SVG書き出し時、非ASCIIファイル名で警告ダイアログが表示される問題を修正（ASCIIに自動フォールバック）。

## Tests / テスト

- E2E smoke test stabilized with retry logic (111 test cases, 63 tools fully covered).
- Added tests for default path generation and previously untested tools (`select_objects`, `place_style_guide`).
- E2Eスモークテストをリトライ機構で安定化（111ケース、全63ツールをカバー）。
- デフォルトパス生成および未テストツール（`select_objects`、`place_style_guide`）のテストを追加。
