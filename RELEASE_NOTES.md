# Illustrator Architecture MCP 0.1.0-alpha.1

首個可公開分發的 alpha：建築與城市小區域分析方法、七個專用工具、同尺度平面資料轉換、來源與證據註記、真實內院孔洞、精確樣式預檢及回讀。

本版補齊 UUID 元資料寫入的工具聲明、通信中斷的未知結果回報與恢復指引。採獨立發行身份、原始碼與 `.tgz` 安裝；新增乾淨安裝及雙入口／雙模式離線驗證，退役上游安裝器身份。預設 README 為繁體中文，同步簡體中文、英文、日語；Skill 與 MCP 分開安裝，CC Switch 使用單一管理來源。

範圍與當次驗證見 [alpha 紀錄](docs/VALIDATION-ALPHA.md)；來源見 [致謝](ACKNOWLEDGEMENTS.md)與 [上游](UPSTREAM.md)，使用邊界見 [免責與使用限制](DISCLAIMER.md)。這是本地準備完成的發行內容，不代表 npm、Registry 或公開 GitHub 倉庫已發佈。

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
