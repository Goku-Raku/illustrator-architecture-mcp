# 提交署名修正 / Commit attribution correction

2026-10-18：依專案擁有者要求，將此 fork 在 `main` 上新增的三個歷史提交，從無法關聯 GitHub 帳號的 `Codex <codex@local.invalid>` 修正為 `Goku-Raku <277898689+Goku-Raku@users.noreply.github.com>`。此電子郵件為 GitHub 提供的隱私地址。修正僅涉及這三個提交的作者、提交者及協助說明；各提交的檔案樹、原作者日期、原提交日期與上游基線均保留。

需求與建築方向由專案發起者提出；本 fork 的新增程式碼與文件由 OpenAI Codex 生成並協助迭代。修正後的提交包含 `Assisted-by: OpenAI Codex`，四語 README 也保留此說明。GitHub 帳號關聯表示專案擁有者的提交歸屬，不表示所有程式碼皆為手寫，也不取代上游作者及第三方的署名與授權。

## 提交對照 / Commit mapping

| 原提交 / Original | 修正後 / Corrected |
| --- | --- |
| `5137481418b321d5bff5a7271a0eac8ddf00e502` | `55048a3bc346c5d26f453ecbc3c1afabb4b02b89` |
| `705d8882f708c214fba9f16fe1dbfdddfe1e6d1b` | `4f9c31ed785aa2315d25f4585e45c2df4ac47a62` |
| `5870b69dff52e506e2d95235109b690286c2b557` | `2ebcb9e7b7f12c8641a2dfb15bac8296a448f324` |

上游基線仍為 `57c5c101a5192c61535493f39b653e6f92b8eb29`。此說明及四語 README 的連結另以新提交記錄，未併入上述三個歷史快照。

## 已發布版本 / Published snapshots

`v0.1.0-alpha.1` 標籤仍指向 `705d8882f708c214fba9f16fe1dbfdddfe1e6d1b`；`v0.1.0-alpha.2` 標籤仍指向 `5870b69dff52e506e2d95235109b690286c2b557`。標籤下的原始提交因此仍保留舊署名。已發布的 alpha.2 Release、附件、下載網址與校驗值保持不變，未重新打包或上傳；GitHub 自動產生的原始碼壓縮檔仍使用同一標籤快照。

若已有本機 clone 或衍生分支，請先保留未提交工作及自己的分支，再取得遠端更新，依自身改動重新接續修正後的 `main`；不要直接將舊的三個提交合併回 `main`。GitHub 的 Contributors 統計可能延遲更新，實際帳號關聯以修正後提交頁為準。

## English

At the owner's request, the three commits added by this fork on `main` were reassigned from an unlinked local Codex identity to `Goku-Raku`, using the account's GitHub-provided privacy address. Each corrected commit preserves its original file tree, author date, committer date, and upstream ancestry. The table above maps old and new commit IDs. This record and the four README links are a separate documentation commit.

The project initiator supplied the requirements and architectural direction. OpenAI Codex generated and helped iterate this fork's added code and documentation. The corrected commits include `Assisted-by: OpenAI Codex`, and all four READMEs retain this disclosure. Account attribution does not imply entirely handwritten code or replace upstream and third-party credits and licenses.

Both existing alpha tags retain their original commit IDs, including the old attribution in those preserved release snapshots. The published alpha.2 release, uploaded assets, download URLs, and checksums are unchanged; nothing was repackaged or reuploaded. GitHub's automatic source archives continue to use the same tagged snapshots. Existing clones should preserve local work and branches before fetching and adapting to the corrected `main`, without merging the three superseded commits back into it. Contributors statistics may lag behind the corrected commit pages.
