/* Willow — static build. Location finder logic ships in the page. No dependencies. */
import { readFileSync, writeFileSync } from 'node:fs';
const site = JSON.parse(readFileSync('data/site.json','utf8'));
const svc  = JSON.parse(readFileSync('data/services.json','utf8'));
const loc  = JSON.parse(readFileSync('data/locations.json','utf8'));
const zips = JSON.parse(readFileSync('data/zips.json','utf8'));

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const byId = Object.fromEntries(svc.services.map(s=>[s.id,s]));

/* validate: no clinic may advertise a service that does not exist */
const bad = loc.locations.flatMap(l=>l.services.filter(s=>!byId[s]).map(s=>`${l.id} -> ${s}`));
if (bad.length){ console.error('  ! unknown service:',bad.join(', ')); process.exit(1) }
const badHours = loc.locations.filter(l=>!Array.isArray(l.hours)||l.hours.length!==7);
if (badHours.length){ console.error('  ! hours must have 7 entries:',badHours.map(l=>l.id).join(', ')); process.exit(1) }

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const h12 = t => { const [H,M]=t.split(':').map(Number);
  const ap=H>=12?'pm':'am', h=H%12||12; return M ? `${h}:${String(M).padStart(2,'0')}${ap}` : `${h}${ap}` };

const LOCS = loc.locations.map(l=>`
      <article class="loc rv" data-id="${esc(l.id)}" data-lat="${l.lat}" data-lng="${l.lng}"
               data-services="${esc(l.services.join(' '))}">
        <div class="top">
          <div>
            <h3>${esc(l.name)}</h3>
            <p class="addr">${esc(l.address)}, Chicago ${esc(l.zip)}</p>
          </div>
          <span class="dist" data-dist hidden></span>
        </div>
        <p class="status" data-status></p>
        <ul class="chips">${l.services.map(s=>`<li data-s="${esc(s)}">${esc(byId[s].name)}</li>`).join('')}</ul>
        ${l.note?`<p class="note">${esc(l.note)}</p>`:''}
        <div class="acts">
          <a class="btn sm fill" href="tel:${l.phone.replace(/[^\d+]/g,'')}">${esc(l.phone)}</a>
          <a class="btn sm" href="https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=17/${l.lat}/${l.lng}"
             target="_blank" rel="noopener noreferrer">Directions</a>
          <button class="hrs-toggle" type="button" aria-expanded="false">Opening hours</button>
        </div>
        <table class="hrs" hidden>
          <caption class="vh">Opening hours for ${esc(l.name)}</caption>
          <tbody>
            ${l.hours.map((hh,i)=>`<tr data-day="${i}"><th scope="row">${DAYS[i]}</th><td>${hh?`${h12(hh[0])} to ${h12(hh[1])}`:'Closed'}</td></tr>`).join('\n            ')}
          </tbody>
        </table>
      </article>`).join('');

const SVC_OPTS = svc.services.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');

const SVC_CARDS = svc.services.map(s=>{
  const at = loc.locations.filter(l=>l.services.includes(s.id));
  return `
      <article class="svc rv">
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.blurb)}</p>
        <p class="at">At <b>${at.length}</b> of ${loc.locations.length} clinics: ${at.map(l=>esc(l.name)).join(', ')}</p>
      </article>`}).join('');

const d = site.demo||{};
const DEMOBAR = d.show?`<div class="demo-bar" role="note"><p>${esc(d.text)}</p><span class="sep">&middot;</span>
  <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.linkText)}</a></div>`:'';
const DEMOFOOT = d.show?`<div class="demo-foot">${esc(d.text)}
  <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.linkText)}</a></div>`:'';

const JSONLD = JSON.stringify(loc.locations.map(l=>({
  '@context':'https://schema.org','@type':'MedicalClinic',
  name:`${site.name} — ${l.name}`, telephone:l.phone,
  address:{'@type':'PostalAddress',streetAddress:l.address,addressLocality:'Chicago',postalCode:l.zip},
  geo:{'@type':'GeoCoordinates',latitude:l.lat,longitude:l.lng},
  availableService:l.services.map(s=>({'@type':'MedicalTherapy',name:byId[s].name}))
})));

const SCRIPT = `<script>
var LOCS=${JSON.stringify(loc.locations.map(l=>({id:l.id,name:l.name,lat:l.lat,lng:l.lng,hours:l.hours})))};
var ZIPS=${JSON.stringify(zips.zips)};
document.getElementById('yr').textContent=new Date().getFullYear();
var nav=document.getElementById('nav');
addEventListener('scroll',function(){nav.classList.toggle('stuck',scrollY>12)},{passive:true});
if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.05});
  document.querySelectorAll('.rv').forEach(function(el){io.observe(el)});
}else{document.querySelectorAll('.rv').forEach(function(el){el.classList.add('in')})}

var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
var cards=$$('.loc'), origin=null;

/* ---------- open now, from the visitor's actual clock ---------- */
function openState(hours){
  var now=new Date(), day=now.getDay(), mins=now.getHours()*60+now.getMinutes();
  function toM(s){ var p=s.split(':'); return +p[0]*60 + +p[1] }
  var today=hours[day];
  if(today && mins>=toM(today[0]) && mins<toM(today[1]))
    return {open:true, text:'Open now, until '+fmt(today[1])};
  if(today && mins<toM(today[0]))
    return {open:false, text:'Closed, opens '+fmt(today[0])};
  for(var i=1;i<=7;i++){
    var n=(day+i)%7, h=hours[n];
    if(h) return {open:false, text:'Closed, opens '+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n]+' '+fmt(h[0])};
  }
  return {open:false, text:'Closed'};
}
function fmt(t){ var p=t.split(':'),H=+p[0],M=+p[1],ap=H>=12?'pm':'am',h=H%12||12;
  return M? h+':'+String(M).padStart(2,'0')+ap : h+ap }

cards.forEach(function(c){
  var L=LOCS.filter(function(x){return x.id===c.dataset.id})[0];
  var st=openState(L.hours), el=c.querySelector('[data-status]');
  el.textContent=st.text; el.classList.add(st.open?'open':'shut');
  var today=new Date().getDay();
  var row=c.querySelector('.hrs tr[data-day="'+today+'"]'); if(row) row.classList.add('today');
});

/* ---------- hours disclosure ---------- */
$$('.hrs-toggle').forEach(function(b){
  b.addEventListener('click',function(){
    var t=b.closest('.loc').querySelector('.hrs');
    var open=t.hidden; t.hidden=!open; b.setAttribute('aria-expanded',String(open));
    b.textContent = open ? 'Hide hours' : 'Opening hours';
  });
});

/* ---------- distance ---------- */
function haversine(a,b,c,d){
  var R=3958.8, p=Math.PI/180;
  var dLat=(c-a)*p, dLng=(d-b)*p;
  var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
}

/* ---------- map ---------- */
var map=null, markers={};
if(window.L && L.map){
  map=L.map('map',{scrollWheelZoom:false}).setView([41.89,-87.68],10.6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  LOCS.forEach(function(p){
    var m=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',
      html:'<span class="pin" data-id="'+p.id+'">'+p.name+'</span>',iconSize:null})}).addTo(map);
    m.on('click',function(){ focus(p.id,true) });
    markers[p.id]=m;
  });
}
function focus(id,scroll){
  cards.forEach(function(c){ c.classList.toggle('hl', c.dataset.id===id) });
  $$('.pin').forEach(function(p){ p.classList.toggle('on', p.dataset.id===id) });
  var card=document.querySelector('.loc[data-id="'+id+'"]');
  if(scroll && card && !card.hidden) card.scrollIntoView({behavior:'smooth',block:'center'});
}
cards.forEach(function(c){ c.addEventListener('click',function(e){
  if(e.target.closest('a,button')) return; focus(c.dataset.id) }) });

/* ---------- render ---------- */
function render(){
  var want=$('#f-service').value;
  var shown=[];
  cards.forEach(function(c){
    var ok = !want || c.dataset.services.split(' ').indexOf(want)>-1;
    c.hidden=!ok;
    c.querySelectorAll('.chips li').forEach(function(li){ li.classList.toggle('hit', !!want && li.dataset.s===want) });
    if(ok) shown.push(c);
  });
  if(origin){
    shown.forEach(function(c){
      var mi=haversine(origin[0],origin[1],+c.dataset.lat,+c.dataset.lng);
      c.dataset.mi=mi;
      var el=c.querySelector('[data-dist]');
      el.hidden=false; el.textContent=mi.toFixed(1)+' mi';
    });
    shown.sort(function(a,b){ return a.dataset.mi-b.dataset.mi });
    var wrap=$('#locs'); shown.forEach(function(c){ wrap.appendChild(c) });
  } else {
    cards.forEach(function(c){ c.querySelector('[data-dist]').hidden=true });
  }
  $('#count').textContent=shown.length;
  $('#countWord').textContent = shown.length===1?'clinic':'clinics';
  $('#nearNote').textContent = origin ? 'sorted by distance' : '';
  $('#emptyState').hidden = shown.length>0;
  if(map){
    var ids={}; shown.forEach(function(c){ids[c.dataset.id]=1});
    Object.keys(markers).forEach(function(id){
      var m=markers[id];
      if(ids[id]){ if(!map.hasLayer(m)) m.addTo(map) } else if(map.hasLayer(m)) map.removeLayer(m);
    });
    var pts=shown.map(function(c){return [+c.dataset.lat,+c.dataset.lng]});
    if(origin) pts.push(origin);
    if(pts.length) map.fitBounds(pts,{padding:[40,40],maxZoom:13});
  }
}
$('#f-service').addEventListener('change',render);

$('#f-zip').addEventListener('input',function(){
  var z=this.value.trim();
  this.classList.remove('err');
  if(z.length===5){
    if(ZIPS[z]){ origin=ZIPS[z]; $('#geoMsg').textContent='Showing clinics near '+z+'.'; render() }
    else { this.classList.add('err'); $('#geoMsg').textContent='We do not have a centroid for '+z+'. Try a Chicago ZIP.' }
  } else if(z.length===0){ origin=null; $('#geoMsg').textContent=''; render() }
});
$('#useMe').addEventListener('click',function(){
  if(!navigator.geolocation){ $('#geoMsg').textContent='This browser will not share a location.'; return }
  var b=this; b.textContent='Locating…';
  navigator.geolocation.getCurrentPosition(function(p){
    origin=[p.coords.latitude,p.coords.longitude];
    $('#f-zip').value=''; $('#geoMsg').textContent='Showing clinics near you.';
    b.textContent='Use my location'; render();
  },function(){
    $('#geoMsg').textContent='Could not get your location. Enter a ZIP instead.';
    b.textContent='Use my location';
  },{timeout:8000});
});
$('#reset').addEventListener('click',function(){
  origin=null; $('#f-zip').value=''; $('#f-zip').classList.remove('err');
  $('#f-service').value=''; $('#geoMsg').textContent=''; render();
});
render();
</script>`;

const vars = {
  NAME:esc(site.name), SHORT:esc(site.short), TAGLINE:esc(site.tagline), CITY:esc(site.city),
  INTRO:esc(site.intro), INTRO_SHORT:esc(site.intro.split('. ')[0]+'.'),
  MAINPHONE:esc(site.mainPhone), MAINPHONE_RAW:site.mainPhone.replace(/[^\d+]/g,''), EMAIL:esc(site.email),
  LOCS, SVC_OPTS, SVC_CARDS, DEMOBAR, DEMOFOOT, SCRIPT, JSONLD,
  N_LOCS: loc.locations.length, N_SVCS: svc.services.length
};
const out = readFileSync('src/index.template.html','utf8')
  .replace(/\{\{(\w+)\}\}/g,(m,k)=> k in vars ? vars[k] : (console.warn('  ! unknown token',k),m));
writeFileSync('index.html', out);
console.log('  built index.html');
console.log(`  ${loc.locations.length} clinics, ${svc.services.length} services, ${Object.keys(zips.zips).length} ZIP centroids`);
