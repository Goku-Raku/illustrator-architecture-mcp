# 上游與本分支

本專案衍生自 [ie3jp/illustrator-mcp-server](https://github.com/ie3jp/illustrator-mcp-server)，基線為 `1.10.3`、提交 `57c5c101a5192c61535493f39b653e6f92b8eb29`。保留原始 [MIT 授權與著作權聲明](LICENSE)。本 alpha 並非 Adobe 或上游作者的官方發行版本。

`illustrator-architecture-mcp` 從發行候選 `0.1.0-alpha.1` 起使用獨立版本，首個公開安裝包版本為 `0.1.0-alpha.2`。新增七項建築／城市分析工具、可校準的平面資料轉換、有證據標記的可編輯覆蓋層，以及配套的 `architecture-diagramming` Skill。一般 Illustrator 工具仍來自上游；新增工具不代表所有上游行為皆已重新實機驗證。

本分支的公開倉庫為 [Goku-Raku/illustrator-architecture-mcp](https://github.com/Goku-Raku/illustrator-architecture-mcp)，[alpha Release](https://github.com/Goku-Raku/illustrator-architecture-mcp/releases/tag/v0.1.0-alpha.2) 提供原始碼 ZIP、本機安裝用 `.tgz`，以及四語可編輯 Illustrator 母版與 PNG。尚未上架 npm、MCP Registry 或外掛市集；`private: true` 用來避免意外發佈至 npm，不影響公開 fork 或本地安裝 tarball。

專案發起者提出需求與建築方向；Codex 生成並協助迭代本 fork 的新增程式碼與文件。這不取代上游著作權或第三方來源標示。

舊的 MCPB、Registry 與 Claude marketplace 中繼資料保留在原始碼的 `upstream-distribution/`，僅作來源記錄。舊的德文、西文、法文、韓文、葡文 README 保留在原始碼的 `upstream-docs/`，不作本 alpha 的安裝指南；這兩組歸檔不隨 runtime 安裝包分發。當前指南為 [繁體中文](README.md)、[簡體中文](README.zh-CN.md)、[English](README.en.md)、[日本語](README.ja.md)。研究方法參考檔目前主要為簡體中文。

後續同步上游時，應逐次審核版本、工具註冊、UUID／備註行為、可編輯性、錯誤回傳與套件內容；不要直接套回上游發行識別。使用鎖定的依賴安裝，重新執行離線、乾淨安裝與必要的 Illustrator 實機驗證。
