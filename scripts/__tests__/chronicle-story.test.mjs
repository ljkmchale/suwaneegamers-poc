import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { addChronicleStories } from '../lib/chronicle-story.mjs';

function fixture(stories){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'chronicle-story-'));
  fs.writeFileSync(path.join(dir,'session-sequences.json'),JSON.stringify(stories));
  return dir;
}
const urls=['/media/images/first.webp','/media/images/second.webp','/media/images/third.webp'];

test('sequence survives generation and replaces the lazy-loader opening image',()=>{
  const dir=fixture({'36':urls});
  const html=addChronicleStories('<script>window.SESSION_ART={"36": "/media/images/cover.webp"};</script>',dir);
  assert.ok(html.includes('"36": "/media/images/first.webp"'));
  assert.ok(html.includes('"/media/images/third.webp"'));
  assert.ok(!html.includes('<button'));
  assert.equal(addChronicleStories('<p>unchanged</p>',os.tmpdir()),'<p>unchanged</p>');
});

test('rejects unsafe or incomplete asset maps before publishing',()=>{
  for(const stories of [{'36':['/media/images/first.webp']},{'36':[urls[0],'https://example.com/image.jpg']},{'bad':urls}]){
    assert.throws(()=>addChronicleStories('',fixture(stories)),/Invalid Chronicle story/);
  }
});

test('cycles loaded scenes, skips failed assets, pauses offscreen and in hidden tabs',async()=>{
  const html=addChronicleStories('',fixture({'36':urls}));
  const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const base={style:{}};
  const overlay={style:{},classList:{add(){},remove(){}},getBoundingClientRect(){return {};}};
  const holder={querySelector(){return base;},appendChild(){},classList:{add(){}}};
  const section={dataset:{},querySelector(selector){return selector==='.hero-art'?holder:{};}};
  let observe,interval,finish;
  const doc={hidden:false,getElementById(){return section;},createElement(){return overlay;}};
  class Image {
    set src(url){queueMicrotask(()=>url===urls[1]?this.onerror():this.onload());}
  }
  class Observer { constructor(callback){observe=callback;} observe(){} }
  vm.runInNewContext(script,{document:doc,window:{IntersectionObserver:Observer},IntersectionObserver:Observer,Image,
    setInterval(callback,ms){assert.equal(ms,12000);interval=callback;},
    setTimeout(callback,ms){assert.equal(ms,2600);finish=callback;}});
  observe([{isIntersecting:true}]);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(base.style.backgroundImage,'url("'+urls[0]+'")');
  interval();assert.equal(overlay.style.backgroundImage,'url("'+urls[2]+'")');finish();
  assert.equal(section.dataset.storyScene,'1');
  doc.hidden=true;interval();assert.equal(section.dataset.storyScene,'1');
  doc.hidden=false;observe([{isIntersecting:false}]);interval();assert.equal(section.dataset.storyScene,'1');
  observe([{isIntersecting:true}]);interval();finish();assert.equal(section.dataset.storyScene,'0');
});
