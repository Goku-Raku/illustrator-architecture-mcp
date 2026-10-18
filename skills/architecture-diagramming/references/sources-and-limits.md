# 方法来源与使用边界

更新：2026-10-18。此文件随 skill 独立安装，保留方法来源；它不是建筑案例数据库、GIS 引擎或素材授权。研究方法经本项目整理、改写成中文分析步骤与图形编码；没有引入这些机构的软件、完整数据集或认证。

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


## 适用边界

本 skill 用于分析与图示表达，不能认证测量、工程、消防、结构、无障碍或法律合规。必须分别标记观察、提供、推断、提案；箭头、扇形、颜色、线宽与合成示范不等于实际性能。真实项目结论须有相应资料和专业核查。

对接 Illustrator 时，确认目标文档并串行操作。部分检查会在对象备注写入 UUID；重要文件保留备份，遇到 outcome_unknown 先核对操作是否结束及实际状态，不自动重试。软件成功、图面好看不代表建筑结论正确。

地图、图片、字体、数据与引用材料保留各自权利。不得把公开可见或提供链接当作转载授权，不宣称来源机构背书。此技能不携带私人建筑库或第三方研究截图。MCP 是本地桥接，但客户端可能把返回内容发送到模型服务。MCP 仓库另附完整 ACKNOWLEDGEMENTS、DISCLAIMER、PRIVACY、SECURITY 和验证记录。

## Pinterest 研究入口

原始研究记录实际阅图 17 个建筑 Pin、12 个新增城市 Pin，另有上文 Dalston 项目图。这里只保留原链接，不重新分发参考图。Pin 发布者未必是作者，项目身份或图例不确定处不能补猜为事实。来源按各自条件使用。

- [研究参考 01](https://fr.pinterest.com/pin/277112183311646324/)
- [研究参考 02](https://www.pinterest.com/pin/7177680651049021/)
- [研究参考 03](https://www.pinterest.com/pin/65231894598452192/)
- [研究参考 04](https://in.pinterest.com/pin/365987907229688586/)
- [研究参考 05](https://www.pinterest.com/pin/474777985700521577/)
- [研究参考 06](https://www.pinterest.com/pin/80642649566064335/)
- [研究参考 07](https://it.pinterest.com/pin/carlo-scarpa-cultural-architecture-arch-architecture--328833210273759823/)
- [研究参考 08](https://za.pinterest.com/pin/4925880834495451/)
- [研究参考 09](https://ca.pinterest.com/pin/intro-in-2024--674273375468229800/)
- [研究参考 10](https://in.pinterest.com/pin/6-senses-of-human--518336238369284860/)
- [研究参考 11](https://www.pinterest.com/pin/426716133415968688/)
- [研究参考 12](https://www.pinterest.com/pin/366058275960740959/)
- [研究参考 13](https://www.pinterest.com/pin/448178600429110793/)
- [研究参考 14](https://www.pinterest.com/pin/main-floor-plan-diagram-circulation--473722454526205362/)
- [研究参考 15](https://www.pinterest.com/pin/108930884716286345/)
- [研究参考 16](https://www.pinterest.com/pin/taxonomy-diagram-taylor-marshall-study-architecture--64668944645435740/)
- [研究参考 17](https://www.pinterest.com/pin/289285976043977393/)
- [研究参考 18](https://uk.pinterest.com/pin/9429480465894920/)
- [研究参考 19](https://in.pinterest.com/pin/analiz-paftas-analysis--4222193393143290/)
- [研究参考 20](https://tr.pinterest.com/pin/8936899254737786/)
- [研究参考 21](https://ru.pinterest.com/pin/927952698196822395/)
- [研究参考 22](https://www.pinterest.com/pin/stage-2-site-inventory-analysis-synthesis-on-behance--735001601685648377/)
- [研究参考 23](https://www.pinterest.com/pin/783204191501527354/)
- [研究参考 24](https://in.pinterest.com/pin/hydrographic-map-of-mumbai--33495590964604565/)
- [研究参考 25](https://es.pinterest.com/pin/2251868554406932/)
- [研究参考 26](https://www.pinterest.com/pin/58265388934694142/)
- [研究参考 27](https://www.pinterest.com/pin/485755509800625713/)
- [研究参考 28](https://www.pinterest.com/pin/157555686937821896/)
- [研究参考 29](https://www.pinterest.com/pin/fichas-usos-de-suelo--624030092140989143/)
