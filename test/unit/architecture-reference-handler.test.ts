import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomFillSync } from 'node:crypto';
import { access, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/executor/jsx-runner.js', async importOriginal => {
  const actual=await importOriginal<typeof import('../../src/executor/jsx-runner.js')>();
  return {...actual,executeJsxHeavy:vi.fn()};
});
import { executeJsxHeavy, JsxToolError } from '../../src/executor/jsx-runner.js';
import { mapPreviewPoints, register } from '../../src/tools/architecture/reference.js';

type AnyRecord = Record<string,any>;
type Handler = (params: AnyRecord) => Promise<AnyRecord>;
const captured: Record<string,{schema:z.ZodObject<any>;handler:Handler}> = {};
register({registerTool(name: string,config: {inputSchema: any},handler: Handler) {
  captured[name]={schema:z.object(config.inputSchema),handler};
}} as unknown as McpServer);
const tool=captured.arch_read_reference;
const bridge=vi.mocked(executeJsxHeavy);
let capturePath='';

function successfulResult(width: number,height: number) {
  return {success:true,expected_document:{name:'Site.ai',path:''},dpi:72,images:[],
    frame:{left:120.25,top:80.5,width,height,artboard_index:2}};
}
function mockCapture(writeCapture: (path: string) => Promise<unknown>,width=2384,height=1684) {
  bridge.mockImplementation(async (_jsx,params) => {
    capturePath=(params as AnyRecord).output_path;
    await writeCapture(capturePath);
    return successfulResult(width,height);
  });
}
function renderSolid(width: number,height: number) {
  return (path: string) => sharp({create:{width,height,channels:3,background:'#dfedee'}}).png().toFile(path);
}
async function read(params: AnyRecord = {}) {
  return tool.handler(tool.schema.parse(params));
}
async function expectCleaned() {
  expect(capturePath).not.toBe('');
  await expect(access(dirname(capturePath))).rejects.toMatchObject({code:'ENOENT'});
}
function body(result: AnyRecord) {
  return JSON.parse(result.content.find((item: AnyRecord) => item.type==='text').text);
}

beforeEach(() => {bridge.mockReset();capturePath='';});
afterEach(async () => {
  // Test-owned directories only; also clean up if an assertion fails.
  if(capturePath) await rm(dirname(capturePath),{recursive:true,force:true,maxRetries:3});
});

describe('architecture reference response and cleanup', () => {
  it('downsamples a large capture without cropping and maps with the final PNG dimensions', async () => {
    mockCapture(renderSolid(2384,1684));
    const result=await read();
    expect(result.isError).not.toBe(true);
    const payload=body(result);
    const data=Buffer.from(result.content.find((item: AnyRecord) => item.type==='image').data,'base64');
    const metadata=await sharp(data).metadata();
    expect(metadata.width).toBe(1800);
    expect(metadata.height).toBe(1271);
    expect(payload.frame).toMatchObject({pixel_width:metadata.width,pixel_height:metadata.height,width:2384,height:1684});
    expect(payload.capture).toEqual({pixel_width:2384,pixel_height:1684,dpi:72});
    expect(payload.expected_document).toEqual({name:'Site.ai'});
    expect(mapPreviewPoints(payload.frame,[{x:0,y:0},{x:metadata.width!,y:metadata.height!}])).toEqual([
      {x:120.25,y:80.5},{x:2504.25,y:1764.5},
    ]);
    await expectCleaned();
  });

  it('does not enlarge an already small capture', async () => {
    mockCapture(renderSolid(320,161),160,80.5);
    const result=await read();
    expect(body(result).frame).toMatchObject({pixel_width:320,pixel_height:161});
    await expectCleaned();
  });

  it('rejects unsupported capture PPI at input validation', () => {
    expect(()=>tool.schema.parse({dpi:36})).toThrow();
    expect(bridge).not.toHaveBeenCalled();
  });

  it('preserves structured JSX failures and removes the temporary directory', async () => {
    bridge.mockImplementation(async (_jsx,params) => {
      capturePath=(params as AnyRecord).output_path;
      throw new JsxToolError('Capture failed',{error:true,message:'Capture failed',line:47,warnings:['Version warning']});
    });
    const result=await read();
    expect(result.isError).toBe(true);
    expect(body(result)).toMatchObject({error:true,message:'Capture failed',line:47,warnings:['Version warning']});
    await expectCleaned();
  });

  it('cleans up when the bridge returns failure without a capture', async () => {
    bridge.mockImplementation(async (_jsx,params) => {
      capturePath=(params as AnyRecord).output_path;
      return {success:false,message:'No capture'};
    });
    const result=await read();
    expect(result.isError).toBe(true);
    expect(body(result).message).toBe('No capture');
    await expectCleaned();
  });

  it('reports a missing PNG and cleans up after a nominally successful bridge call', async () => {
    mockCapture(async()=>{});
    const result=await read();
    expect(result.isError).toBe(true);
    expect(body(result).message).toContain('ENOENT');
    await expectCleaned();
  });

  it('reports an unreadable PNG and cleans up', async () => {
    mockCapture(path=>writeFile(path,'not a readable PNG capture'));
    const result=await read();
    expect(result.isError).toBe(true);
    expect(body(result).message).toContain('readable PNG');
    await expectCleaned();
  });

  it('enforces the actual capture size before decoding a too-large image', async () => {
    mockCapture(async path => {
      const header=Buffer.alloc(24);
      Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(header);
      header.writeUInt32BE(9000,16);header.writeUInt32BE(100,20);
      await writeFile(path,header);
    });
    const result=await read();
    expect(result.isError).toBe(true);
    expect(body(result).message).toContain('exceeds 8192 pixels');
    await expectCleaned();
  });

  it('cleans up after PNG decoding fails despite a valid-looking header', async () => {
    mockCapture(async path => {
      const valid=await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).png().toBuffer();
      await writeFile(path,valid.subarray(0,33));
    },100,100);
    const result=await read();
    expect(result.isError).toBe(true);
    await expectCleaned();
  });

  it('rejects an oversized final PNG and removes the capture', async () => {
    const width=2048,height=1536;
    const pixels=randomFillSync(Buffer.alloc(width*height*3));
    mockCapture(path=>sharp(pixels,{raw:{width,height,channels:3}}).png().toFile(path),width,height);
    const result=await read({max_pixels:4096});
    expect(result.isError).toBe(true);
    expect(body(result).message).toContain('Preview exceeds 8 MiB');
    await expectCleaned();
  },15000);
});
