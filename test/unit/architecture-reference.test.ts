import { describe, expect, it } from 'vitest';
import { mapPreviewPoints, referenceJsx } from '../../src/tools/architecture/reference.js';
import { runJsxCode } from './helpers/run-tool-jsx.js';

describe('architecture preview coordinate mapping', () => {
  const frame={left:120,top:80,width:600,height:300,pixel_width:1200,pixel_height:600,artboard_index:2};
  it('maps crop corners and an interior point with Y down', () => {
    expect(mapPreviewPoints(frame,[{x:0,y:0},{x:1200,y:600},{x:400,y:200}])).toEqual([{x:120,y:80},{x:720,y:380},{x:320,y:180}]);
  });
  it('uses independently rounded actual image dimensions', () => {
    expect(mapPreviewPoints({...frame,pixel_height:601},[{x:600,y:300.5}])).toEqual([{x:420,y:230}]);
  });
  it.each([{x:-1,y:0},{x:0,y:601},{x:NaN,y:1},{x:Infinity,y:0}])('rejects invalid or out-of-image coordinates %s', p=> {
    expect(()=>mapPreviewPoints(frame,[p])).toThrow();
  });
  it('rejects zero-size frames',()=> {
    expect(()=>mapPreviewPoints({...frame,width:0},[{x:0,y:0}])).toThrow();
  });
  it('emits valid JavaScript for the bridge',()=> {
    expect(()=>new Function(referenceJsx)).not.toThrow();
  });
});

describe('architecture capture bounds', () => {
  function capture(rect: number[], params: Record<string, unknown> = {}) {
    const calls: Array<{clip: number[]; resolution: number}> = [];
    const artboards = Object.assign([{name:'Plan',artboardRect:rect}],{getActiveArtboardIndex:()=>0});
    const document = {
      name:'Site.ai',fullName:{fsName:'C:\\Drawings\\Site.ai'},artboards,placedItems:[],rasterItems:[],
      imageCapture(_file: unknown,clip: number[],options: {resolution: number}) {
        calls.push({clip,resolution:options.resolution});
      },
    };
    const result = runJsxCode(referenceJsx,{
      app:{activeDocument:document},
      File:function(this: Record<string,unknown>,value: string) {this.path=value;},
      ImageCaptureOptions:function() {},RGBColor:function() {},
    },{dpi:144,max_pixels:1800,image_limit:100,output_path:'test.png',...params});
    return {result,calls};
  }

  it('captures a large architectural sheet at the supported minimum PPI', () => {
    const {result,calls}=capture([0,3370,2384,0]);
    expect(result.success).toBe(true);
    expect(calls).toEqual([{clip:[0,3370,2384,0],resolution:72}]);
  });

  it('translates a fractional crop on an offset artboard without changing the frame', () => {
    const region={left:10.25,top:20.5,width:300.75,height:200.25};
    const {result,calls}=capture([100,500,1100,-200],{region});
    expect(calls[0]).toEqual({clip:[110.25,479.5,411,279.25],resolution:144});
    expect(result.frame).toEqual({...region,artboard_index:0});
  });

  it.each([
    {left:900,top:0,width:101,height:100},
    {left:0,top:650,width:100,height:51},
    {left:-1,top:0,width:100,height:100},
  ])('rejects out-of-artboard crops before rendering: %s', region => {
    const {result,calls}=capture([100,500,1100,-200],{region});
    expect(result).toMatchObject({error:true,message:'Capture region must lie inside the artboard'});
    expect(calls).toHaveLength(0);
  });

  it.each([[0,100,8193,0],[0,6000,6000,0]])('rejects unsafe capture dimensions before rendering: %s', (...rect) => {
    const {result,calls}=capture(rect);
    expect(result.error).toBe(true);
    expect(result.message).toContain('Request a smaller detail region');
    expect(calls).toHaveLength(0);
  });
});
