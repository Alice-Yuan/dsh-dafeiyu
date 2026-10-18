import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { MEDIA_LIMITS, mediaUrl, downloadMedia, decodedFrames, findDecoder, runDecoder, FfmpegMediaReader } from '../dist/platform/media.js';
import { publicVideo } from '../dist/pilot/material.js';
const sig=()=>new AbortController().signal;
const url='https://upos-synthetic.bilivideo.com/upgcxcode/synthetic.mp4?token=synthetic';
test('media URL boundary rejects cross-site, credentials, local targets and playlists',()=>{
 assert.equal(mediaUrl(url).hostname,'upos-synthetic.bilivideo.com');
 for(const u of ['http://upos.bilivideo.com/upgcxcode/a','https://bilivideo.com.evil.test/upgcxcode/a','https://evil.test/upgcxcode/a','https://u:p@upos.bilivideo.com/upgcxcode/a','https://upos.bilivideo.com:8443/upgcxcode/a','https://127.0.0.1/upgcxcode/a','file:///a','https://upos.bilivideo.com/a','https://upos.bilivideo.com/upgcxcode/a#secret'])assert.throws(()=>mediaUrl(u),/MEDIA_TARGET_DENIED/);
});
test('media download strips credentials, forbids redirects and enforces declared/streamed sizes',async()=>{
 const mp4=Buffer.concat([Buffer.from([0,0,0,12]),Buffer.from('ftypisom')]);
 const b=await downloadMedia(url,sig(),async(u,o)=>{assert.equal(o.redirect,'error');assert.deepEqual(o.headers,{Referer:'https://www.bilibili.com/'});return new Response(mp4);});assert.deepEqual(b,mp4);
 await assert.rejects(downloadMedia(url,sig(),async()=>new Response(mp4,{headers:{'content-length':String(MEDIA_LIMITS.bytes+1)}})),/MEDIA_TOO_LARGE/);
 await assert.rejects(downloadMedia(url,sig(),async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(MEDIA_LIMITS.bytes+1));c.close();}}))),/MEDIA_TOO_LARGE/);
 await assert.rejects(downloadMedia(url,sig(),async()=>new Response('#EXTM3U\nhttp://localhost/secret')),/MEDIA_FORMAT_UNSUPPORTED/);
 await assert.rejects(downloadMedia(url,sig(),async()=>{throw Error('signed-url-must-not-leak')}),e=>e.code==='MEDIA_DOWNLOAD_FAILED'&&!e.message.includes('signed-url'));
});
test('frame times and public provenance exclude binary data and invented coverage',()=>{
 const frame=Buffer.from([255,216,1,2,255,217]);
 const rows=decodedFrames(frame,'n: 0 pts: 0 pts_time:0',54);assert.equal(rows.length,1);
 assert.throws(()=>decodedFrames(frame,'n: 0 pts: 0 pts_time:99',54),/MEDIA_FRAME_INVALID/);
 assert.throws(()=>decodedFrames(Buffer.concat([frame,frame]),'n: 0 pts: 0 pts_time:0\nn: 1 pts: 0 pts_time:0',54),/MEDIA_FRAME_INVALID/);
 const data=publicVideo({bvid:'synthetic',subtitle:null,visual:{source:'video-stream',durationSeconds:54,streamSha256:'test',downloadedBytes:12,frames:rows,audio:'not-transcribed',coverage:'sampled-frames'}});
 assert.equal(data.visual.audio,'not-transcribed');assert.equal(data.visual.coverage,'sampled-frames');assert.ok(!JSON.stringify(data).includes('jpeg'));
});
test('decoder cancellation ends the owned process without shell execution',async()=>{
 const c=new AbortController(),op=runDecoder(process.execPath,['-e','setInterval(()=>{},1000)'],c.signal);setTimeout(()=>c.abort(),30);
 await assert.rejects(op,/CANCELLED/);
});

test('missing optional decoder is explicit and does not install anything',async()=>{
 await assert.rejects(findDecoder(''),/MEDIA_DECODER_UNAVAILABLE/);
});
test('actual FFmpeg handles synthetic MP4, preserves timestamps and removes temporary media',async t=>{
 let decoder;try{decoder=await findDecoder();}catch{return t.skip('FFmpeg is an optional local runtime prerequisite');}
 const dir=await mkdtemp(resolve('tmp/media-test-'));
 try {
 const {out}=await runDecoder(decoder.ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=160x120:rate=10','-t','2','-threads','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],sig());
 const reader=new FfmpegMediaReader(dir,async()=>new Response(out));
 const material=await reader.read(url,2,sig());assert.ok(material.frames.length>=8);assert.equal(material.audio,'not-transcribed');assert.equal((await readdir(dir)).length,0);
 await assert.rejects(reader.read(url,601,sig()),/MEDIA_DURATION_LIMIT/);
 await assert.rejects(reader.read(url,20,sig()),/MEDIA_METADATA_INVALID/);assert.deepEqual(await readdir(dir),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
