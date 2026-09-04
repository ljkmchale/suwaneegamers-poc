// The Bloody Endeavor Chronicle builder — turns bloody-endeavor-chronicle.md into a self-contained HTML page.
// Usage:  node build-chronicle.mjs            (reads/writes this folder)
//         node build-chronicle.mjs <dir> <out.html>
// Inputs (same folder): bloody-endeavor-chronicle.md, chronicle.css, session-images.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] || HERE;
const OUT = process.argv[3] || path.join(DIR, 'bloody-endeavor-chronicle.html');

function themeFor(title, body){
  // Title carries the chapter's identity, so match on it first; fall back to the body.
  const tt=title.toLowerCase(), bb=body.toLowerCase();
  const pick=(src)=>{
    const has=(...k)=>k.some(w=>src.includes(w));
    if(has('wine')) return 'wine';
    if(has('cemetery','bodies','baby','grief','bitter',' ate ','spitespirit','grave','undead','effers','boots','bad news')) return 'crypt';
    if(has('volcano','emberheart','eradic','salamander','forge','lava')) return 'ember';
    if(has('dock','drowned','waypoint','sewer','tide','boat','ship','underwater')) return 'sea';
    if(has('grove','sanctuary','goose','silver','giant','tracker','forest','bimblefol','nunglthil','home','ulgrey')) return 'grove';
    if(has('wizard','tablet','divine','egd','slaad','zabeek','prevail','cloak','sides','trust','oh no')) return 'arcane';
    return null;
  };
  return pick(tt) || pick(bb) || 'ember';
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);}
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function inline(s){let x=esc(s);x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');x=x.replace(/\*([^*]+)\*/g,'<em>$1</em>');x=x.replace(/\\([!\[\]()#.\-+>~`_])/g,'$1');return x;}

const SIGILS=[
 '<circle cx="60" cy="60" r="46" /><circle cx="60" cy="60" r="30" /><path d="M60 14V106 M14 60H106 M28 28 92 92 M92 28 28 92"/>',
 '<circle cx="60" cy="60" r="44"/><path d="M60 16 L96 78 H24 Z"/><circle cx="60" cy="60" r="14"/>',
 '<circle cx="60" cy="60" r="46"/><path d="M60 14 L74 50 L112 50 L82 74 L94 110 L60 88 L26 110 L38 74 L8 50 L46 50 Z" transform="scale(.72) translate(23 23)"/>',
 '<circle cx="60" cy="60" r="46"/><circle cx="60" cy="42" r="18"/><circle cx="60" cy="78" r="18"/><path d="M60 6V114"/>',
 '<path d="M60 10 L104 84 H16 Z"/><path d="M60 110 L16 36 H104 Z"/><circle cx="60" cy="60" r="10"/>',
 '<circle cx="60" cy="60" r="46"/><path d="M24 60 Q60 20 96 60 Q60 100 24 60 Z"/><circle cx="60" cy="60" r="7"/>',
];

function parseSession(lines){
  const head=lines[0].trim().replace(/^\*\s+/, '').match(/^(\d{1,2})\s*[–-]\s*(.+?)\s*$/);
  const num=head[1].padStart(2,'0'); const title=head[2].trim();
  let sdate='',idate='',loc=''; const blocks=[]; let i=1; let firstPara=true;
  while(i<lines.length){
    let line=lines[i]; let m;
    if(/^\s*$/.test(line)){i++;continue;}
    if((m=line.match(/^Session Date:\s*(.+)/))){sdate=m[1].trim();i++;continue;}
    if((m=line.match(/^In-game Date:\s*(.+)/))){idate=m[1].trim();i++;continue;}
    if((m=line.match(/^Starting Location:\s*(.+)/))){loc=m[1].trim();i++;continue;}
    if((m=line.match(/^##\s+(.+)/))){blocks.push({t:'h2',v:m[1].replace(/\*\*/g,'').trim()});i++;continue;}
    if((m=line.match(/^###\s+(.+)/))){blocks.push({t:'h3',v:m[1].replace(/\*\*/g,'').trim()});i++;continue;}
    if(/^\s*\|/.test(line)){
      const tb=[]; while(i<lines.length && /^\s*\|/.test(lines[i])){tb.push(lines[i]);i++;}
      const rows=tb.map(r=>r.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim()));
      const body=rows.filter(r=>!r.every(c=>/^:?-+:?$/.test(c)));
      const maxCols=Math.max(...body.map(r=>r.length));
      if(maxCols<=1){
        const flat=body.flat().filter(c=>c!==''); if(flat.length) blocks.push({t:'inscription',v:flat});
      } else {
        const headerHasText=body.length && body[0].some(c=>c!=='');
        blocks.push({t:'table',head: headerHasText?body[0]:null, rows: headerHasText?body.slice(1):body});
      }
      continue;
    }
    if(/^\s*[-*]\s+/.test(line)){
      const items=[]; while(i<lines.length && /^\s*[-*]\s+/.test(lines[i])){items.push(lines[i].replace(/^\s*[-*]\s+/,''));i++;}
      blocks.push({t:'ul',v:items}); continue;
    }
    if(/^COMBAT\s*[–-]\s*IT IS INITIATIVE/i.test(line.trim())){blocks.push({t:'combat',v:line.trim()});i++;continue;}
    if(/^[–\-]{1,2}\s*The End of the Session/i.test(line.trim())){blocks.push({t:'end',v:line.trim()});i++;continue;}
    if(line.trim().length<=64 && !/[.!?…:]$/.test(line.trim()) && !/^WE STOP HERE/i.test(line.trim())){blocks.push({t:'h2',v:line.trim()});i++;continue;}
    blocks.push({t:'p',v:line.trim(),drop:firstPara}); firstPara=false; i++;
  }
  return {num,title,sdate,idate,loc,blocks};
}

function renderBlocks(blocks){
  return blocks.map(b=>{
    if(b.t==='h2') return `<h2 class="scene">${inline(b.v)}</h2>`;
    if(b.t==='h3') return `<h3 class="subscene">${inline(b.v)}</h3>`;
    if(b.t==='p') return `<p${b.drop?' class="lead"':''}>${inline(b.v)}</p>`;
    if(b.t==='ul') return `<ul class="log">${b.v.map(x=>`<li>${inline(x)}</li>`).join('')}</ul>`;
    if(b.t==='combat') return `<div class="combat"><span>${inline(b.v)}</span></div>`;
    if(b.t==='end') return `<div class="endmark">${inline(b.v)}</div>`;
    if(b.t==='inscription') return `<figure class="inscription"><div class="insc-frame">${b.v.map(x=>`<p>${inline(x)}</p>`).join('')}</div></figure>`;
    if(b.t==='table'){
      const thead=b.head?`<thead><tr>${b.head.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead>`:'';
      const tbody=`<tbody>${b.rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      return `<div class="tablewrap"><table class="ledger">${thead}${tbody}</table></div>`;
    }
    return '';
  }).join('\n');
}

function renderSession(s){
  const theme=themeFor(s.title, s.blocks.map(b=>b.v||'').join(' '));
  const h=hash(s.title+s.num); const sigil=SIGILS[h%SIGILS.length];
  const gx=18+(h%64), gy=58+((h>>4)%34);
  return `
<section class="session" id="s${s.num}" data-theme-art="${theme}" style="--gx:${gx}%;--gy:${gy}%">
  <header class="hero">
    <div class="hero-art" aria-hidden="true">
      <div class="hero-photo"></div>
      <svg class="sigil" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.4">${sigil}</svg>
      <div class="embers"></div>
    </div>
    <div class="hero-inner">
      <div class="kicker">Bloody Endeavor II · Chapter ${parseInt(s.num,10)}</div>
      <div class="numeral">${parseInt(s.num,10)}</div>
      <h1>${inline(s.title)}</h1>
      <div class="hero-meta">
        ${s.idate?`<span class="mi"><i>In-World</i>${esc(s.idate)}</span>`:''}
        ${s.loc?`<span class="mi"><i>Where</i>${esc(s.loc)}</span>`:''}
        ${s.sdate?`<span class="mi"><i>Played</i>${esc(s.sdate)}</span>`:''}
      </div>
    </div>
  </header>
  <div class="account">
    ${renderBlocks(s.blocks)}
  </div>
</section>`;
}

// ---- split master doc into sessions ----
const md=fs.readFileSync(DIR+'/bloody-endeavor-chronicle.md','utf8');
const lines=md.split('\n');
// One- or two-digit session numbers exclude date/history rows such as 1879–1903.
const normalizedSessionHead=l=>l.trim().replace(/^\*\s+/, '');
const isSessionHead=l=>/^\d{1,2}\s*[–-]\s*\S/.test(normalizedSessionHead(l));
const starts=[]; lines.forEach((l,i)=>{if(isSessionHead(l))starts.push(i);});
// Multi-tab Google Docs exports can repeat a session. Build the last complete copy
// for each session number and stop each slice at its explicit end marker so tab
// appendices cannot leak into the chapter body.
const sessionsByNumber=new Map();
starts.forEach((st,k)=>{
  const next=starts[k+1]??lines.length;
  const slice=lines.slice(st,next);
  const end=slice.findIndex((line,index)=>index>0 && /[–-]\s*The (?:Session Ends Here|End of the Session)\s*[–-]?/i.test(line.trim()));
  const bounded=end>-1?slice.slice(0,end+1):slice;
  const parsed=parseSession(bounded);
  sessionsByNumber.set(parsed.num,parsed);
});
// This Chronicle intentionally begins with the post-Bakah party era. Session 27
// is still parsed as the continuity boundary, but the public volume starts at 28.
const sessions=[...sessionsByNumber.values()]
  .filter((session)=>Number(session.num)>=28)
  .sort((a,b)=>Number(a.num)-Number(b.num));

const rail=sessions.map(s=>`<li class="on"><a href="#s${s.num}"><span class="rn">${parseInt(s.num,10)}</span><span class="rt">${inline(s.title)}</span></a></li>`).join('\n');
const css=fs.readFileSync(DIR+'/chronicle.css','utf8');

// Persistent per-session art. Seed the in-file editable map from session-images.json (if present)
// so images survive every regeneration. Keys are chapter numbers ("01".."33"); values are image URLs.
let seedImages={};
try{ seedImages=JSON.parse(fs.readFileSync(DIR+'/session-images.json','utf8')); }catch{}
const artSeed=sessions.map(s=>`    "${s.num}": ${JSON.stringify(seedImages[s.num]||"")}`).join(',\n');

const html=`<title>Bloody Endeavor II Chronicle</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cinzel+Decorative:wght@700;900&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap">
<style>${css}</style>

<!-- ============================================================
     SESSION ART  —  EDIT THIS BLOCK TO SET EACH CHAPTER'S HERO IMAGE
     Paste an image URL (https://...) or a path next to a chapter number.
     Leave "" to keep the procedural themed backdrop for that chapter.
     This is the ONLY place you need to touch to add art. Nothing else.
     ============================================================ -->
<script>
window.SESSION_ART = {
${artSeed}
};
</script>

<div class="scrollbar"><div class="scrollbar-fill" id="pbar"></div></div>

<div class="chronicle">
  <aside class="rail">
    <a class="rail-back" href="/campaigns/bloody-endeavor" aria-label="Back to Bloody Endeavor II campaign">&larr; <span>Bloody Endeavor II</span></a>
    <div class="rail-head">
      <div class="rail-title">Bloody Endeavor II<br>Chronicle</div>
      <div class="rail-sub">A living account, as the party tells it</div>
    </div>
    <nav><ol class="rail-list">${rail}</ol></nav>
    <div class="rail-foot">${sessions.length} chapters &middot; Bloody Endeavor II</div>
  </aside>

  <main class="scroll">
    ${sessions.map(renderSession).join('\n')}
    <footer class="pagefoot">Suwanee Gamers &middot; Bloody Endeavor II Chronicle</footer>
  </main>
</div>

<script>
(function(){
  var bar=document.getElementById('pbar');
  var scroller=document.querySelector('.scroll');

  // Load only nearby chapter art. Assigning all 33 background URLs at startup
  // makes the browser download the full chronicle gallery before it is needed.
  var art=window.SESSION_ART||{};
  var artEntries=[];
  Object.keys(art).forEach(function(n){
    var url=art[n]; if(!url) return;
    var sec=document.getElementById('s'+n); if(!sec) return;
    var photo=sec.querySelector('.hero-photo'), holder=sec.querySelector('.hero-art');
    if(photo) artEntries.push({sec:sec,photo:photo,holder:holder,url:url,loaded:false});
  });
  function loadArt(entry){
    if(entry.loaded) return;
    entry.loaded=true;
    var img=new Image();
    img.decoding='async';
    img.onload=function(){
      entry.photo.style.backgroundImage="url('"+entry.url.replace(/'/g,"%27")+"')";
      entry.holder.classList.add('has-photo');
    };
    img.onerror=function(){entry.loaded=false;};
    img.src=entry.url;
  }
  if('IntersectionObserver' in window){
    var artObserver=new IntersectionObserver(function(entries){
      entries.forEach(function(observed){
        if(!observed.isIntersecting) return;
        var entry=artEntries.find(function(candidate){return candidate.sec===observed.target;});
        if(entry){loadArt(entry);artObserver.unobserve(entry.sec);}
      });
    },{root:scroller,rootMargin:'125% 0px',threshold:0.01});
    artEntries.forEach(function(entry){artObserver.observe(entry.sec);});
  }else{
    artEntries.forEach(loadArt);
  }
  function upd(){var h=scroller.scrollHeight-scroller.clientHeight;bar.style.transform='scaleX('+(h>0?scroller.scrollTop/h:0)+')';}
  scroller.addEventListener('scroll',upd,{passive:true});upd();
  var links=[].slice.call(document.querySelectorAll('.rail-list a'));
  var secs=links.map(function(a){return document.querySelector(a.getAttribute('href'));});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var i=secs.indexOf(e.target);if(i>-1){links.forEach(function(a){a.parentElement.classList.remove('active');});links[i].parentElement.classList.add('active');links[i].scrollIntoView({block:'nearest'});}}});},{root:scroller,threshold:0,rootMargin:'-45% 0px -50% 0px'});
  secs.forEach(function(s){if(s)io.observe(s);});
})();
</script>`;

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length/1024).toFixed(0)+'KB', '·', sessions.length, 'chapters');
