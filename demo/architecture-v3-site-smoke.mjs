// Default: read-only SDK contract check. --draw: a NEW, synthetic Illustrator document.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'outputs');
await mkdir(output, { recursive: true });
const draw = process.argv.includes('--draw');
const bundle = process.argv.includes('--bundle');
const languageIndex = process.argv.indexOf('--lang');
const language = languageIndex < 0 ? 'zh-CN' : process.argv[languageIndex + 1];
const defaultFonts = { 'zh-TW':'MicrosoftJhengHeiRegular', 'zh-CN':'MicrosoftYaHei', en:'ArialMT', ja:'Meiryo' };
if (!Object.hasOwn(defaultFonts, language)) throw new Error('Use --lang zh-TW|zh-CN|en|ja.');
const fontIndex = process.argv.indexOf('--font');
const font = fontIndex < 0 ? defaultFonts[language] : process.argv[fontIndex + 1];
if (!font) throw new Error('--font requires an installed PostScript font name.');
const translations = JSON.parse(await readFile(resolve(root, 'demo/urban-demo-translations.json'), 'utf8'));
function translated(value) {
  if (language === 'zh-CN' || !/[\u3400-\u9fff]/u.test(value)) return value;
  const text = translations[value]?.[language];
  if (!text) throw new Error(`Missing ${language} translation: ${value}`);
  return text;
}
const client = new Client({ name: 'architecture-v3-site-verification', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(root, bundle ? 'dist/bundle.cjs' : 'dist/index.js')],
  env: { ...process.env, ILLUSTRATOR_ARCHITECTURE_ONLY: draw ? '0' : '1' } });
const log = [];
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const body = result.content.find(c => c.type === 'text')?.text;
  let data; try { data = JSON.parse(body); } catch { data = { text: body }; }
  log.push({ name, result: data });
  if (result.isError || data.success === false || data.error) throw new Error(`${name}: ${JSON.stringify(data)}`);
  return data;
}
const ink = '#263E41', teal = '#25797C', orange = '#B76744', gray = '#6C7F80';
const source = 'Synthetic local planar teaching data; metres; NOT a surveyed site or routing-engine result';
const rect = (x,y,w,h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const feature = (id,type,coordinates) => ({ type:'Feature',id,geometry:{type,coordinates} });
const nearPath = [[380,100],[380,160],[625,160],[625,350]];
const farPath = [[380,100],[380,460],[625,460],[625,350]];
const length = points => points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
if (length(nearPath)!==495 || length(farPath)!==715) throw new Error('Synthetic edge length mismatch');
function mapInput(expected,frame,night,batch) {
  const features = [
    feature('courtyard-ground','Polygon',[rect(80,360,240,140)]),
    feature('courtyard-building','Polygon',[rect(80,360,240,140),rect(125,390,150,80)]),
    feature('housing','MultiPolygon',[[rect(80,60,190,160)],[rect(80,240,200,60)],[rect(680,65,200,130)]]),
    feature('library','Polygon',[rect(625,300,225,120)]),
    feature('park','Polygon',[rect(680,450,245,95)]),
    feature('river','Polygon',[rect(470,0,65,600)]),
    feature('streets','MultiLineString',[[[380,55],[380,545]],[[625,55],[625,545]],[[280,270],[380,270]],[[320,430],[380,430]]]),
    feature('bridges','MultiLineString',[[[380,160],[625,160]],[[380,460],[625,460]]]),
    feature('selected-route','LineString',night?farPath:nearPath),
    feature('origin','Point',[380,100]),feature('destination','Point',[625,350]),
    feature('crossings','MultiPoint',[[470,160],[535,160],[470,460],[535,460]]),
  ];
  if(night) features.push(feature('closed-gate','Point',[500,160]));
  const styles = {
    'courtyard-ground':{role:'courtyard_ground',fill:'#CFDEC4'},
    'courtyard-building':{role:'figure_ground_with_courtyard',fill:'#748480'},
    housing:{role:'building_footprint',fill:'#D5DCD5'},
    library:{role:'destination_building',fill:'#D6E8E4'},
    park:{role:'mapped_green_area',fill:'#DCE8CD'},
    river:{role:'river_barrier',fill:'#C6DFE7'},
    streets:{role:'declared_walkable_links',stroke:{color:'#B0BDB5',width_pt:5}},
    bridges:{role:'declared_bridge_links',stroke:{color:'#A1AEA7',width_pt:7}},
    'selected-route':{role:'explicit_teaching_path',stroke:{color:night?orange:teal,width_pt:3.5},evidence:'Manual path on the stated synthetic graph; length is the sum of its straight metric segments; no speed or delay assumption'},
    origin:{role:'station_exit',fill:teal,point_shape:'triangle',point_size_pt:13},
    destination:{role:'library_entrance',fill:teal,point_shape:'diamond',point_size_pt:13},
    crossings:{role:'bridge_bank_connection',fill:'#FFFFFF',stroke:{color:'#899B93',width_pt:1},point_size_pt:5},
    'closed-gate':{role:'closed_at_21h',fill:orange,point_shape:'cross',point_size_pt:17},
  };
  return {expected_document:expected,artboard_index:0,batch_id:batch,layer_name:night?'21h site map':'08h site map',
    geojson:{type:'FeatureCollection',features},source_coordinates:{kind:'local_planar',crs:'SYNTHETIC_CARTESIAN_METRES',units:'m',y_axis:'up'},source_ref:source,
    source_extent:[0,0,1000,600],frame,
    feature_styles:features.map(f=>({feature_id:f.id,style:{evidence_kind:'supplied',...styles[f.id]}}))};
}
try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map(t=>t.name);
  if(!names.includes('arch_prepare_site_map')) throw new Error('Missing site-map tool');
  const topics=['overview','workflow','analysis_atlas','visual_encoding','worked_examples','mcp_execution','urban_site','urban_atlas','urban_example'];
  for(const topic of topics) {
    const r=await call('arch_get_diagram_guidance',{topic});
    if(!r.content||r.content.length<100) throw new Error(`Empty ${topic}`);
    log.at(-1).result={success:r.success,topic,characters:r.content.length,source:r.source};
  }
  const preview=await call('arch_prepare_site_map',mapInput({name:'unopened-contract-check.ai'},{left:60,top:220,width:700,height:420},false,'v3-read-only'));
  if(preview.overlay_params.elements.find(e=>e.kind==='compound_zone').holes.length!==1) throw new Error('Polygon hole missing');
  if(preview.calibration.scale_pt_per_source_unit!==0.7) throw new Error('Shared metric scale changed');
  if(!draw) console.log(JSON.stringify({connected:true,architecture_tools:names.filter(n=>n.startsWith('arch_')),guidance_topics:topics.length,calibration:preview.calibration}));
  if(draw) {
    const fonts=await call('list_fonts',{filter:font,limit:100});
    if(!fonts.fonts.some(f=>f.name===font)) throw new Error(`${font} is not installed; pass --font with a suitable installed font.`);
    await call('create_document',{width:1600,height:1060,color_mode:'rgb'});
    const before=await call('get_document_info',{coordinate_system:'artboard-web'});
    const expected={name:before.fileName};
    const stamp=Date.now();
    const frames=[{left:60,top:225,width:700,height:420},{left:840,top:225,width:700,height:420}];
    const prepared=[];
    for(let i=0;i<2;i++) prepared.push(await call('arch_prepare_site_map',mapInput(expected,frames[i],!!i,`city-${stamp}-${i}`)));
    const after=await call('get_document_info',{coordinate_system:'artboard-web'});
    if(JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Read-only preparation changed document info');
    let serial=0;
    const back=[],front=[];
    const push=(arr,role,geometry)=>arr.push({id:`board-${++serial}`,role,evidence_kind:'proposed',source_ref:source,...geometry});
    const box=(arr,x,y,w,h,fill)=>push(arr,'page_layout',{kind:'zone',points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],fill});
    const label=(x,y,text,size=15,fill=ink)=>push(front,'annotation',{kind:'label',anchor:[x,y],text:translated(text),font_name:font,font_size_pt:language==='en'&&size===31?29:size,fill});
    const line=(pts,color=gray,width=1,dash=[])=>push(front,'annotation_line',{kind:'boundary',points:pts,closed:false,stroke:{color,width_pt:width,dash_pt:dash}});
    box(back,0,0,1600,1060,'#F4F3EC');
    box(back,40,164,740,558,'#FFFFFF'); box(back,820,164,740,558,'#FFFFFF');
    label(60,61,'城市小区域分析：把“附近”拆成真正的到达条件',31);
    label(60,100,'同一底图、同一尺度、同一目的地；只改变一座桥的开放状态。',18,teal);
    label(60,133,'教学坐标与通行规则全部为假设  ·  不是实际场地调查  ·  长度为给定路径线段求和，未模拟步行时间',13,gray);
    label(62,199,'08:00  近桥开放',22,teal); label(842,199,'21:00  近桥关闭',22,orange);
    await call('arch_add_overlay',{expected_document:expected,artboard_index:0,batch_id:`city-back-${stamp}`,layer_name:'City board background',elements:back});
    const applied=[];
    for(const p of prepared) applied.push(await call('arch_add_overlay',p.overlay_params));
    const map=(i,p)=>[frames[i].left+p[0]*.7,frames[i].top+(600-p[1])*.7];
    for(let i=0;i<2;i++) {
      const at=(p,t,size=13,color=gray,dx=0,dy=0)=>{const q=map(i,p);label(q[0]+dx,q[1]+dy,t,size,color);};
      at([80,535],'图底：建筑轮廓保留院落孔洞',12);
      at([680,475],'绿地范围',13,'#687D58');
      at([670,363],'目的地入口',14,teal);
      at([300,73],'车站出口',14,teal,-8,17);
      at([460,490],'桥 A · 全天',12,gray,-14,-9);
      at([475,120],i?'桥 B · 已关闭':'桥 B · 08:00–20:00',12,i?orange:teal,-35,17);
      at([492,310],'河',15,'#6F939F');
      const bar=map(i,[65,20]); line([[bar[0],bar[1]],[bar[0]+140,bar[1]]],ink,2);
      line([[bar[0],bar[1]-4],[bar[0],bar[1]+4]],ink);line([[bar[0]+140,bar[1]-4],[bar[0]+140,bar[1]+4]],ink);
      label(bar[0],bar[1]-10,'0                         200 m',11,gray);
      label(frames[i].left+8,682,i?'给定路径 715 m  ·  超出假设的 500 m 距离预算':'给定路径 495 m  ·  在假设的 500 m 距离预算内',17,i?orange:teal);
      label(frames[i].left+8,707,i?'须核查另一通路、桥梁开放或目的地时段；不能仍画满圆。':'只证明此时段这条路径；不证明无障碍、舒适或夜间可达。',12,gray);
    }
    line([[60,756],[1540,756]],'#BCC9C0');
    const cols=[60,575,1090];
    label(cols[0],799,'01  信息 → 元素',20,teal);
    label(cols[0],831,'建筑与院落 → 带洞图底',15);
    label(cols[0],857,'入口与桥头 → 不同形状的节点',15);
    label(cols[0],883,'通行连接 → 有拓扑依据的线段',15);
    label(cols[0],909,'关闭规则 → 分时小图与关闭标记',15);
    label(cols[1],799,'02  判断 → 设计动作',20,teal);
    label(cols[1],831,'先确认哪一段路造成服务缺口。',15);
    label(cols[1],857,'再比较延长开桥、增加连接、调整服务点。',15);
    label(cols[1],883,'同时核查资格、坡度、照明与运营责任。',15);
    label(cols[1],909,'不把“缩短 220 m”直接说成综合最优。',15);
    label(cols[2],799,'03  可追溯的制作',20,teal);
    label(cols[2],831,'源要素 ID → 语义 ID → AI 对象 UUID',15);
    label(cols[2],857,'共同 extent + 等比例坐标转换',15);
    label(cols[2],883,'原生文字、线、节点与复合路径',15);
    label(cols[2],909,'复合孔洞透出下方绿色；不是白块遮盖。',15);
    label(60,998,'下一步取证：桥梁时刻表、入口开放、合法步行网络、坡度与目的地服务资格。',17,teal);
    label(60,1031,'MCP 负责把可靠几何与编码落到 Illustrator；不自动计算等时圈、交通量、洪水或城市性能。',13,gray);
    const annotations=await call('arch_add_overlay',{expected_document:expected,artboard_index:0,batch_id:`city-labels-${stamp}`,layer_name:`City labels and interpretation (${language})`,elements:front});
    const textIds=front.filter(e=>e.kind==='label').map(e=>e.id);
    const textUuids=annotations.elements.filter(e=>textIds.includes(e.id)).flatMap(e=>e.components.map(c=>c.uuid));
    const textCheck=await call('arch_inspect_elements',{expected_document:expected,uuids:textUuids,limit:200});
    if(textCheck.elements.length!==textIds.length || textCheck.elements.some(e=>e.type!=='TextFrame')) throw new Error('Editable text inventory mismatch');
    for(const item of textCheck.elements) {
      const [left,top,right,bottom]=item.bounds_document_pt;
      if(left<40 || right>1560 || bottom<10 || top>1050) throw new Error(`Text outside the page safe area: ${item.name}`);
    }
    const courtyard=prepared[0].feature_mapping.find(f=>f.feature_id==='courtyard-building');
    const appliedCourtyard=applied[0].elements.find(e=>e.id===courtyard.semantic_ids[0]);
    const inspection=await call('arch_inspect_elements',{expected_document:expected,uuids:appliedCourtyard.components.map(c=>c.uuid),include_points:true});
    await writeFile(resolve(output,`v3-site-inputs-${language}.json`),JSON.stringify({inputs:frames.map((f,i)=>mapInput(expected,f,!!i,`city-${stamp}-${i}`)),prepared},null,2));
    const aiPath=resolve(output,`architecture-v3-urban-${language}-${stamp}.ai`),pngPath=resolve(output,`architecture-v3-urban-${language}-${stamp}.png`);
    await call('save_document',{mode:'save_as',path:aiPath});
    await call('export',{target:'artboard:0',format:'png',output_path:pngPath,raster_options:{dpi:90,background:'white'}});
    console.log(JSON.stringify({language,font,aiPath,pngPath,editable_text_frames:textIds.length,text_safe_area_checked:true,read_only_prepare_unchanged:true,map_elements:applied.map(a=>a.elements.length),courtyard_child_paths:inspection.elements[0].child_count,scale_pt_per_m:prepared[0].calibration.scale_pt_per_source_unit},null,2));
  }
} finally {
  await writeFile(resolve(output,draw?`v3-live-${language}-log.json`:bundle?'v3-bundle-log.json':'v3-stdio-log.json'),JSON.stringify(log,null,2));
  await client.close();
}
