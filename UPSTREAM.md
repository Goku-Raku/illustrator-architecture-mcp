# 上游與本分支

本專案衍生自 [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server)，基線為 `1.10.3`、提交 `57c5c101a5192c61535493f39b653e6f92b8eb29`。保留原始 [MIT 授權與著作權聲明](LICENSE)。本 alpha 並非 Adobe 或上游作者的官方發行版本。

`illustrator-architecture-mcp` 從 `0.1.0-alpha.1` 起使用獨立版本。新增七項建築／城市分析工具、可校準的平面資料轉換、有證據標記的可編輯覆蓋層，以及配套的 `architecture-diagramming` Skill。一般 Illustrator 工具仍來自上游；新增工具不代表所有上游行為皆已重新實機驗證。

本 alpha 採原始碼與 `.tgz` 安裝。尚未設定本分支的公開倉庫地址或 npm Registry 發行身份；`private: true` 用來避免意外發佈至 npm，不影響原始碼公開或本地安裝 tarball。

舊的 MCPB、Registry 與 Claude marketplace 中繼資料保留在原始碼的 `upstream-distribution/`，僅作來源記錄。舊的德文、西文、法文、韓文、葡文 README 保留在原始碼的 `upstream-docs/`，不作本 alpha 的安裝指南；這兩組歸檔不隨 runtime 安裝包分發。當前指南為 [繁體中文](README.md)、[簡體中文](README.zh-CN.md)、[English](README.en.md)、[日本語](README.ja.md)。研究方法參考檔目前主要為簡體中文。

後續同步上游時，應逐次審核版本、工具註冊、UUID／備註行為、可編輯性、錯誤回傳與套件內容；不要直接套回上游發行識別。使用鎖定的依賴安裝，重新執行離線、乾淨安裝與必要的 Illustrator 實機驗證。
