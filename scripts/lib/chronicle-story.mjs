import fs from 'node:fs';
import path from 'node:path';

// Keep each campaign's sequence beside its image map so scheduled rebuilds preserve it.
export function addChronicleStories(html, directory) {
  const file=path.join(directory,'session-sequences.json');
  if(!fs.existsSync(file))return html;
  const stories=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [chapter,urls] of Object.entries(stories)) {
    if(!/^\d{2}$/.test(chapter)||!Array.isArray(urls)||urls.length<2||
      urls.some(url=>typeof url!=='string'||!/^\/media\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg)$/.test(url))) {
      throw new Error(`Invalid Chronicle story sequence: ${chapter}`);
    }
    // The regular lazy loader must use the opening scene, too.
    html=html.replace(new RegExp('("'+chapter+'": )"[^"\\n]*"'), '$1'+JSON.stringify(urls[0]));
  }
  return html+`<style>
.hero-photo.story-incoming{opacity:0;transition:opacity 2.5s ease-in-out}
.has-photo .hero-photo.story-incoming{opacity:0}
.has-photo .hero-photo.story-incoming.visible{opacity:1}
@media(prefers-reduced-motion:reduce){.hero-photo.story-incoming{transition:none}}
</style>
<script>
(function(){
  var stories=${JSON.stringify(stories).replace(/</g,'\\u003c')};
  Object.keys(stories).forEach(function(chapter){
    var section=document.getElementById('s'+chapter);if(!section)return;
    var holder=section.querySelector('.hero-art'),base=holder.querySelector('.hero-photo');
    var incoming=document.createElement('div');incoming.className='hero-photo story-incoming';
    holder.appendChild(incoming);
    var scenes=[],index=0,visible=false,started=false,busy=false;
    function background(url){return 'url('+JSON.stringify(url)+')';}
    function start(){
      if(started)return;started=true;
      Promise.all(stories[chapter].map(function(url){return new Promise(function(resolve){
        var image=new Image();image.decoding='async';
        image.onload=function(){resolve(url);};image.onerror=function(){resolve(null);};image.src=url;
      });})).then(function(loaded){
        scenes=loaded.filter(Boolean);if(!scenes.length)return;
        base.style.backgroundImage=background(scenes[0]);holder.classList.add('has-photo');
        section.dataset.storyScene='0';
      });
    }
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(entries){
        visible=entries[0].isIntersecting;if(visible)start();
      },{threshold:0.05}).observe(section.querySelector('.hero'));
    }else{visible=true;start();}
    setInterval(function(){
      if(!visible||busy||document.hidden||scenes.length<2)return;
      busy=true;var next=(index+1)%scenes.length;
      incoming.style.backgroundImage=background(scenes[next]);incoming.classList.add('visible');
      setTimeout(function(){
        base.style.backgroundImage=background(scenes[next]);
        incoming.style.transition='none';incoming.classList.remove('visible');
        incoming.getBoundingClientRect();incoming.style.transition='';
        index=next;section.dataset.storyScene=String(index);busy=false;
      },2600);
    },12000);
  });
})();
</script>`;
}
