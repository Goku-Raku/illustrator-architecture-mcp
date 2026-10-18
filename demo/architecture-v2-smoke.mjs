// Read-only by default. --draw creates a NEW demonstration document in Illustrator.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'outputs');
await mkdir(output, { recursive: true });
const client = new Client({ name: 'architecture-v2-verification', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(root, process.argv.includes('--bundle') ? 'dist/bundle.cjs' : 'dist/index.js')],
  env: { ...process.env, ILLUSTRATOR_ARCHITECTURE_ONLY: process.argv.includes('--draw') ? '0' : '1' } });
const log = [];
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content.find(c => c.type === 'text')?.text;
  let data; try { data = JSON.parse(text); } catch { data = { text }; }
  log.push({ name, result: data });
  if (result.isError || data.success === false || data.error) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
}
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map(t => t.name);
  if (!names.includes('arch_get_diagram_guidance')) throw new Error('Missing guidance tool');
  for (const topic of ['overview', 'workflow', 'analysis_atlas', 'visual_encoding', 'worked_examples', 'mcp_execution']) {
    const result = await call('arch_get_diagram_guidance', { topic });
    if (!result.content || result.content.length < 100) throw new Error(`Empty guidance: ${topic}`);
    log.at(-1).result = { success: result.success, topic, characters: result.content.length, source: result.source };
  }
  console.log(JSON.stringify({ connected: true, architecture_tools: names.filter(n => n.startsWith('arch_')), guidance_topics: 6 }));
  if (process.argv.includes('--draw')) {
    const created = await call('create_document', { width: 1200, height: 900, color_mode: 'rgb' });
    const info = await call('get_document_info', { coordinate_system: 'artboard-web' });
    const expected = { name: info.fileName };
    const fontData = await call('list_fonts', { filter: 'MicrosoftYaHei', limit: 20 });
    if (!fontData.fonts.some(f => f.name === 'MicrosoftYaHei')) throw new Error('Demo font MicrosoftYaHei is unavailable');
    let serial = 0;
    const els = [];
    const ink = '#203B3D', teal = '#277C80', orange = '#B57645', gray = '#788A88';
    const semantic = role => ({ id: `demo-${++serial}`, role, evidence_kind: 'proposed', source_ref: 'Synthetic teaching example; no site measurements', evidence: 'Illustrator MCP v2 geometry and methodology demonstration' });
    const add = (role, element) => { const e = { ...semantic(role), ...element }; els.push(e); return e; };
    const text = (x, y, content, size = 14, fill = ink) => add('annotation', { kind: 'label', anchor: [x, y], text: content, font_name: 'MicrosoftYaHei', font_size_pt: size, fill });
    const box = (x, y, w, h, fill, opacity = 100) => add('diagram_area', { kind: 'zone', points: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]], fill, opacity });
    const line = (points, color = gray, width = 1, dash = []) => add('boundary', { kind: 'boundary', points, closed: false, stroke: { color, width_pt: width, dash_pt: dash } });
    const mark = (center, shape, fill, size = 12) => add('node', { kind: 'marker', center, shape, size_pt: size, fill });
    box(0, 0, 1200, 900, '#F5F4ED');
    text(52, 56, '从空间问题到可编辑分析图', 30);
    text(54, 88, '问题 → 证据 → 空间关系 → 视觉编码 → 设计动作 → 验证', 16, teal);
    text(54, 116, '建筑分析图 MCP  ·  v2 能力样张  ·  全部为教学示意，无真实项目性能数据', 12, gray);
    line([[52,137],[1148,137]], '#B4C3BA');
    for (const [x,y,w,h] of [[52,164,532,310],[616,164,532,310],[52,496,532,344],[616,496,532,344]]) box(x,y,w,h,'#FFFFFF');
    text(76, 200, '01  流线：入口、路径与停留节点', 18);
    box(90,228,195,162,'#E7EEEB'); box(298,228,245,162,'#E7EEEB');
    text(111, 254, '公共厅'); text(327,254,'共享活动区');
    const curve = add('proposed_access_route', { kind: 'smooth_route', start: [94,362], segments: [
      { control1: [154,362], control2: [198,293], end: [275,309] },
      { control1: [329,321], control2: [348,351], end: [492,300] }], stroke: { color: teal, width_pt: 3 }, arrow: 'end', arrow_length_pt: 12, arrow_width_pt: 9 });
    mark([94,362], 'triangle', teal, 17); mark([275,309], 'circle', teal, 16); mark([492,300], 'diamond', teal, 17);
    text(81,420,'曲线用控制柄调整；节点形状区别入口、停留与目的地。',12,gray);
    text(81,445,'核查：有门可过、方向连续，线宽不冒充客流量。',12,gray);
    text(640,200,'02  视线：观者、目标与范围',18);
    add('view_direction_sketch', { kind:'sector',center:[730,327],radius_pt:225,start_degrees:-17,end_degrees:17,fill:'#DFC092',opacity:40 });
    line([[682,243],[1070,243],[1070,396],[682,396]],'#AAB7B1');
    mark([730,327],'circle',orange,15); mark([945,292],'square',teal,14);
    line([[735,327],[945,292]],orange,1.5,[6,4]);
    text(670,365,'观者'); text(965,296,'目标');
    text(644,420,'扇形表示关注方向；结合剖面、眼高与真实障碍核查。',12,gray);
    text(644,445,'此工具不求解可视域，不自动裁切墙后区域。',12,gray);
    text(76,535,'03  时间：同一底图的状态对照',18);
    for (const [x, night] of [[83,false],[334,true]]) {
      text(x,566,night?'18:00–22:00  部分开放':'09:00–18:00  同时开放',13);
      box(x,587,200,120,'#E7EEEB');
      line([[x+96,587],[x+96,643]],gray,1.5);
      line([[x+96,673],[x+96,707]],gray,1.5);
      if(night) line([[x+96,643],[x+96,673]],orange,1.5);
      text(x+14,618,'活动'); text(x+116,618,'阅览');
      if(night) add('closed_area', {kind:'hatch',points:[[x+100,587],[x+200,587],[x+200,707],[x+100,707]],stroke:{color:'#9CA9A3',width_pt:0.6},spacing_pt:9,opacity:55});
      add('access_route',{kind:'route',points:night?[[x+20,690],[x+65,644]]:[[x+20,690],[x+65,664],[x+155,653]],stroke:{color:teal,width_pt:2},arrow:'end'});
      mark([x+20,690],'triangle',teal,12);
      if(night) mark([x+96,658],'cross',orange,12);
    }
    text(80,746,'共享尺度与图例，改变开放状态；保留关闭区与门槛。',12,gray);
    text(80,772,'设计动作：测试夜间独立入口、支持空间与关闭边界。',12,gray);
    text(80,807,'时间、功能与门位为假设；完整运营还需厕所等依据。',11,orange);
    text(640,535,'04  编码：每种视觉变化都有意义',18);
    const rows = [['triangle','入口 / 起点'],['circle','停留 / 观者'],['diamond','目标 / 转换'],['cross','关闭 / 冲突']];
    rows.forEach(([shape,label],i)=>{mark([660,580+i*42],shape,i===3?orange:teal,15);text(686,585+i*42,label,14);});
    text(640,776,'对象记录：角色 + 证据类别 + 来源 + 数据引用',12,gray);
    text(640,807,'几何与文字可编辑；成组样式修改后读回验证。',12,gray);
    text(54,870,'方法不是元素清单：每张图都应让一个设计决定更清楚。',14,teal);
    const stamp = Date.now();
    const input = { expected_document: expected, artboard_index: 0, batch_id: `demo-v2-${stamp}`, layer_name: 'V2 Teaching Diagram', elements: els };
    await writeFile(resolve(output,'v2-demo-input.json'),JSON.stringify(input,null,2));
    const overlay = await call('arch_add_overlay',input);
    const curveResult = overlay.elements.find(e=>e.id===curve.id);
    const curveUuid = curveResult.components.find(e=>e.component==='route')?.uuid || curveResult.components[0].uuid;
    const edits = [{ uuid: curveUuid, style: { stroke_width: 3.5, semantic: { data_ref: 'Teaching example: categorical route, no volume data' } } }];
    await call('arch_style_elements',{expected_document:expected,edits});
    await call('arch_style_elements',{expected_document:expected,edits,dry_run:false});
    const inspected = await call('arch_inspect_elements',{uuids:[curveUuid],include_points:true});
    if(inspected.elements[0].semantic.data_ref!=='Teaching example: categorical route, no volume data') throw new Error('Provenance roundtrip failed');
    const aiPath=resolve(output,`architecture-v2-${stamp}.ai`), pngPath=resolve(output,`architecture-v2-${stamp}.png`);
    await call('save_document',{mode:'save_as',path:aiPath});
    await call('export',{target:'artboard:0',format:'png',output_path:pngPath,raster_options:{dpi:90,background:'white'}});
    console.log(JSON.stringify({aiPath,pngPath,element_count:overlay.elements.length,primitive_count:overlay.primitive_count,curveUuid}));
  }
} finally {
  const logName = process.argv.includes('--draw') ? 'v2-live-log.json' : process.argv.includes('--bundle') ? 'v2-bundle-log.json' : 'v2-stdio-log.json';
  await writeFile(resolve(output,logName),JSON.stringify(log,null,2));
  await client.close();
}
