import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { executeJsxHeavy, JsxToolError } from '../../executor/jsx-runner.js';
import { readImageDimensions } from '../../utils/image-header.js';
import { formatToolResult } from '../tool-executor.js';
import { READ_ANNOTATIONS, WRITE_ANNOTATIONS } from '../modify/shared.js';

const finite = z.number().finite();
const MAX_CAPTURE_EDGE = 8192;
const MAX_CAPTURE_PIXELS = 32_000_000;
export const frameSchema = z.object({
  left: finite, top: finite, width: finite.positive(), height: finite.positive(),
  pixel_width: finite.int().positive(), pixel_height: finite.int().positive(),
  artboard_index: finite.int().min(0),
});
export type PreviewFrame = z.infer<typeof frameSchema>;
export function mapPreviewPoints(frame: PreviewFrame, points: Array<{ x: number; y: number }>) {
  frameSchema.parse(frame);
  return points.map(p => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > frame.pixel_width || p.y > frame.pixel_height) {
      throw new Error('Point is outside the captured image. Use its original pixel dimensions, not a resized UI thumbnail.');
    }
    return { x: frame.left + p.x * frame.width / frame.pixel_width,
      y: frame.top + p.y * frame.height / frame.pixel_height };
  });
}

export const referenceJsx = `
var preflight = preflightChecks();
if (preflight) { writeResultFile(RESULT_PATH, preflight); }
else { try {
  var params = readParamsFile(PARAMS_PATH), doc = app.activeDocument;
  var ai = params.artboard_index;
  if (ai === undefined) ai = doc.artboards.getActiveArtboardIndex();
  if (ai < 0 || ai >= doc.artboards.length) throw new Error('Artboard index out of range');
  var ab = doc.artboards[ai], r = ab.artboardRect;
  var aw = r[2]-r[0], ah = r[1]-r[3];
  var region = params.region || {left:0, top:0, width:aw, height:ah};
  if (region.left < 0 || region.top < 0 || region.left+region.width > aw+0.001 || region.top+region.height > ah+0.001) throw new Error('Capture region must lie inside the artboard');
  // ImageCaptureOptions supports 72–2400 PPI. Large artboards must be
  // downsampled in Node after capture, never by requesting unsupported PPI.
  var dpi = Math.max(72, Math.min(params.dpi, 72*params.max_pixels/Math.max(region.width,region.height)));
  var captureWidth = Math.ceil(region.width*dpi/72), captureHeight = Math.ceil(region.height*dpi/72);
  if (captureWidth > ${MAX_CAPTURE_EDGE} || captureHeight > ${MAX_CAPTURE_EDGE} || captureWidth*captureHeight > ${MAX_CAPTURE_PIXELS}) {
    throw new Error('Capture would exceed 8192 pixels per edge or 32 million pixels at the minimum supported 72 PPI. Request a smaller detail region.');
  }
  var clip = [r[0]+region.left, r[1]-region.top, r[0]+region.left+region.width, r[1]-region.top-region.height];
  var opt = new ImageCaptureOptions(); opt.resolution = dpi; opt.antiAliasing = true; opt.transparency = false;
  opt.matte = true; var white = new RGBColor(); white.red=255;white.green=255;white.blue=255;opt.matteColor=white;
  doc.imageCapture(new File(params.output_path), clip, opt);
  var docPath = ''; try { docPath = doc.fullName.fsName; } catch(e) {}
  var imgs = [], total = doc.placedItems.length + doc.rasterItems.length;
  function addImage(item) {
    if (imgs.length >= params.image_limit) return;
    var b = item.geometricBounds;
    if (b[2]<clip[0] || b[0]>clip[2] || b[1]<clip[3] || b[3]>clip[1]) return;
    var info = {uuid:ensureUUID(item),name:item.name,typename:item.typename,bounds:getBounds(item,'artboard-web',r),opacity:item.opacity,locked:item.locked,hidden:item.hidden,layer:item.layer.name};
    try { var m=item.matrix;info.matrix={a:m.mValueA,b:m.mValueB,c:m.mValueC,d:m.mValueD,tx:m.mValueTX,ty:m.mValueTY}; } catch(e) {}
    try { info.file_path=item.file.fsName; info.link_broken=!item.file.exists; } catch(e) {}
    try { info.embedded=item.embedded; } catch(e) {}
    var parent=item.parent;info.clipped=false;info.ancestor_locked=false;info.ancestor_hidden=false;
    while(parent && parent.typename !== 'Document') {
      try { if(parent.clipped) info.clipped=true; } catch(e) {}
      try { if(parent.locked) info.ancestor_locked=true; } catch(e) {}
      try { if(parent.hidden || parent.visible===false) info.ancestor_hidden=true; } catch(e) {}
      parent=parent.parent;
    }
    imgs.push(info);
  }
  for(var i=0;i<doc.placedItems.length;i++) addImage(doc.placedItems[i]);
  for(var j=0;j<doc.rasterItems.length;j++) addImage(doc.rasterItems[j]);
  writeResultFile(RESULT_PATH, {success:true,expected_document:{name:doc.name,path:docPath},artboard:{index:ai,name:ab.name,rect:[r[0],r[1],r[2],r[3]],width:aw,height:ah},frame:{left:region.left,top:region.top,width:region.width,height:region.height,artboard_index:ai},dpi:dpi,images:imgs,image_count_in_document:total,image_limit_reached:imgs.length>=params.image_limit});
} catch(e) { writeResultFile(RESULT_PATH,{error:true,message:e.message,line:e.line}); } }
`;

export function register(server: McpServer): void {
  server.registerTool('arch_read_reference', {
    title: 'Read architectural reference with coordinate frame',
    description: 'Return a rendered PNG of an artboard or detail crop plus raster-object metadata and a preview-to-artboard coordinate frame. Capture uses at least 72 PPI, then proportionally downsamples without cropping to max_pixels. Capture is limited to 8192 pixels per edge and 32 million pixels; request a detail region for larger artwork. The host vision model inspects this image for candidate boundaries/routes/labels; this tool performs no OCR or semantic recognition. Rendering respects image rotation, crop and clipping. PNG/JPG internal lines are pixels, not editable vector paths. Does not alter artwork geometry; UUID metadata may be assigned. Temporary capture cleanup is best-effort; crashes, timeouts or cleanup failures can leave local files behind.',
    inputSchema: {
      artboard_index: finite.int().min(0).optional(),
      region: z.object({left:finite.min(0),top:finite.min(0),width:finite.positive(),height:finite.positive()}).optional(),
      dpi: finite.min(72).max(300).default(144).describe('Preferred Illustrator capture PPI; the returned preview may be downsampled to fit max_pixels.'),
      max_pixels: finite.int().min(256).max(4096).default(1800),
      image_limit: finite.int().min(1).max(500).default(100),
    }, annotations: WRITE_ANNOTATIONS,
  }, async params => {
    const dir = await mkdtemp(join(tmpdir(), 'illustrator-arch-preview-'));
    try {
      const file = join(dir, 'reference.png');
      const result = await executeJsxHeavy(referenceJsx, {...params,output_path:file}) as Record<string, any>;
      if (result.error || result.success === false) return formatToolResult(result);
      const size = readImageDimensions(file);
      if (!size || size.width < 1 || size.height < 1) return formatToolResult({error:true,message:'Capture did not produce a readable PNG.'});
      if (size.width > MAX_CAPTURE_EDGE || size.height > MAX_CAPTURE_EDGE || size.width*size.height > MAX_CAPTURE_PIXELS) {
        return formatToolResult({error:true,message:'Captured PNG exceeds 8192 pixels per edge or 32 million pixels. Request a smaller detail region.'});
      }
      const {data:bytes,info} = await sharp(file,{limitInputPixels:MAX_CAPTURE_PIXELS})
        .resize(params.max_pixels,params.max_pixels,{fit:'inside',withoutEnlargement:true})
        .png().toBuffer({resolveWithObject:true});
      if (bytes.length > 8*1024*1024) return formatToolResult({error:true,message:'Preview exceeds 8 MiB; reduce max_pixels or request a detail crop.'});
      result.frame.pixel_width=info.width; result.frame.pixel_height=info.height;
      result.capture={pixel_width:size.width,pixel_height:size.height,dpi:result.dpi};
      result.preview_dpi={x:72*info.width/result.frame.width,y:72*info.height/result.frame.height};
      if (!result.expected_document.path) delete result.expected_document.path;
      for (const img of result.images ?? []) {
        if (img.file_path && !img.link_broken) {
          try { const d = readImageDimensions(img.file_path); if(d) img.source_pixels=d; } catch { /* embedded/unreadable link */ }
        }
      }
      result.coordinate_system='artboard-web';
      result.mapping='x_pt = left + x_pixel * width / pixel_width; y_pt = top + y_pixel * height / pixel_height. Coordinates use the returned image, not the raw source file. Origin is top-left; Y-down; dimensions in points. Allow one preview-pixel of capture rounding.';
      result.next_step='Visually inspect the image, record observed/inferred/proposed/supplied evidence, map points, then add editable overlays. Re-read after moving/resizing the base or artboard. Never infer real north, scale, climate or measured traffic from appearance alone.';
      return { content:[{type:'text' as const,text:JSON.stringify(result,null,2)},{type:'image' as const,mimeType:'image/png',data:bytes.toString('base64')}] };
    } catch(e) {
      return formatToolResult(e instanceof JsxToolError ? e.result : {error:true,message:e instanceof Error ? e.message : String(e)});
    } finally { await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:50}); }
  });
  server.registerTool('arch_map_preview_points', {
    title: 'Map preview pixels to artboard points',
    description: 'Map visually selected points from the original arch_read_reference PNG to Illustrator artboard-web points, including detail-crop offset. Pure calculation; does not validate whether the document has changed. Re-capture stale images before editing.',
    inputSchema: { frame:frameSchema, points:z.array(z.object({x:finite,y:finite})).min(1).max(2000) },
    annotations:READ_ANNOTATIONS,
  }, async params => {
    try { return formatToolResult({coordinate_system:'artboard-web',artboard_index:params.frame.artboard_index,points:mapPreviewPoints(params.frame,params.points)}); }
    catch(e) { return formatToolResult({error:true,message:String(e)}); }
  });
}
