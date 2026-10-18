# 建筑分析图方法论：让每张图推动一个设计决定

这次改进把“能在 Illustrator 上画什么”向前延伸到“为什么要画、依据是什么、图能支持什么、下一步改哪里”。可审阅的工作链是：

**分析问题 → 证据 → 空间关系 → 抽象 → 编码 → 画面构成 → 验证 → 设计动作。**

输出是简短设计决策卡、可追溯的元素和能核查的图纸，不要求输出私密思维链，也不强制固定图种数量。详细方法放在配套 skill 的自包含参考中，MCP 的只读 `arch_get_diagram_guidance` 读取同一份正文，避免维护两套内容。

## 先从哪个入口读

| 你的情况 | 直接阅读 | 会得到什么 |
|---|---|---|
| “我不知道这个项目能分析什么” | [方法与决策卡](../skills/architecture-diagramming/references/method.md)＋[36 个分析维度](../skills/architecture-diagramming/references/analysis-atlas.md) | 把场地、流线等主题改成可决定的问题，并知道最少要补什么 |
| “我分析的是街区/社区/片区，不只是建筑” | [城市分析入口](URBAN-SITE-ANALYSIS.zh-CN.md) | 四种边界、40 个城市维度、路网/时段/统计口径与完整教学案 |
| “有信息，但不知道能抽象成什么元素” | [视觉语法](../skills/architecture-diagramming/references/visual-language.md) | 点、路径、门槛、区域、视域、时段、样本、系统层及其编码边界 |
| “只有截图，可不可以先做” | [情境一：只有底图](../skills/architecture-diagramming/references/examples.md) | 先做可信的拓扑与缺口定位，不补猜测的尺度、北向和性能 |
| “我要证明共享空间在不同时段能用” | [情境二：跨时段图书馆](../skills/architecture-diagramming/references/examples.md) | 从运营表找到门禁、到达与厕所依赖冲突，再比较具体改法 |
| “要在 Illustrator 里实际做” | [MCP 执行与能力边界](../skills/architecture-diagramming/references/mcp-execution.md) | 配准、语义、覆盖层、预检、成图验证和当前尚不支持的组件 |
| “想让 Codex 每次都按这套方法协作” | [architecture-diagramming/SKILL.md](../skills/architecture-diagramming/SKILL.md) | 精简入口与按需读入路由，建议任务与绘图任务都可用 |

## 与上一版的区别

下述记录第二轮建筑方法扩展；第三轮增加的城市模块、地图坐标编译与真实孔洞见 [v3 城市升级](UPGRADE-V3.zh-CN.md)。

上一版的五个 `arch_` 接口完成了“读取底图—坐标对准—可编辑覆盖—批量修改—复查”。本次补足以下层次：

- **分析广度**：从场地/流线/功能/填充扩展到剖面、分时运营、支持空间、比较、生态与改造，共 36 个可选择维度。
- **元素语义**：除色块和箭头，还明确节点/门槛、视点/视域、状态转换、系统对齐、原始观察样本和来源索引如何承载信息。
- **证据追溯**：分直接可见、资料提供、推断、提案；新来源字段记录图号/URL/数据位置，不把记录来源等同于验证真伪。
- **设计闭环**：每个选定的发现对应可试的空间操作、收益/代价与复查方法；分析图不止停留在分类。
- **执行能力**：新增节点标记、三次贝塞尔路径、几何扇形，以及只读方法查询；现有工具继续负责几何和对象读写。

Skill 负责选择与解释，MCP 负责可靠执行；这种分工让方法能独立指导设计，也让程序不必把不同建筑判断硬编码成“自动正确”的结果。

## 直接使用的请求示例

> 用 architecture-diagramming 方法看我的底图。先找最值得决定的问题，选择相关分析维度，给出证据、要画的元素、图能支持的结论和下一步空间操作。资料不够时先做可成立的部分，并告诉我哪些缺项最可能改变结论。

> 根据这张图，在 Illustrator 上添加可编辑分析层。先区分事实、推断与提案；为路径、节点、区域和标签记录依据。画完重新看图，检查配准、穿墙、门禁状态、图例和文字，再保存新版本。

研究样本与访问范围见 [Pinterest 研究记录](PINTEREST-RESEARCH.zh-CN.md)；可迁移的精选例子也随 skill 放入 [视觉语法参考](../skills/architecture-diagramming/references/visual-language.md)，安装后仍可追溯。
