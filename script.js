/* =======================
   Futuristic Dino Run
   ======================= */

const gameEl = document.getElementById('game');
const groundEl = document.getElementById('ground');
const dinoEl = document.getElementById('dino');
const dinoEmojiEl = document.getElementById('dino-emoji');
const yehoEl = document.getElementById('yeho');
const btnRun = document.getElementById('btnRun');
const btnJump = document.getElementById('btnJump');
const btnRestart = document.getElementById('btnRestart');
const btnOverlayRestart = document.getElementById('btnOverlayRestart');
const btnShop = document.getElementById('btnShop');
const speedText = document.getElementById('speedText');
const goldText = document.getElementById('goldText');
const skinText = document.getElementById('skinText');
const toastEl = document.getElementById('toast');
const gameOverEl = document.getElementById('gameOver');
const shopModal = document.getElementById('shopModal');
const shopClose = document.getElementById('shopClose');
const shopGoldText = document.getElementById('shopGoldText');
const shopGrid = document.querySelector('.shop-grid');

/* ---- Persistent economy ---- */
const ECON = {
  gold: 0,
  ownedSkins: { green: true }, // default
  selected: 'green',
};
const SKINS = [
  { id:'green',  name:'Green Dino', price:0,    emoji:'🦖', glow:'#21ffa2' },
  { id:'purple', name:'Purple Dino',price:300,  emoji:'🦖', glow:'#b96bff' },
  { id:'blue',   name:'Blue Dino',  price:500,  emoji:'🦖', glow:'#61f7ff' },
  { id:'yeho',   name:'Yeho Dino',  price:1000, emoji:'🦖', glow:'#ff5a7a' },
  { id:'kunal',  name:'Kunal Dino', price:1500, emoji:'🦖', glow:'#ffd166' },
  { id:'aiden',  name:'Aiden Dino', price:2500, emoji:'🦖', glow:'#00e5ff' },
];
const STORAGE_KEY = 'futuro-dino-progress-v1';

function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return saveProgress();
    const obj = JSON.parse(raw);
    Object.assign(ECON, obj);
  }catch{}
  updateGoldUI();
  applySkin(ECON.selected);
}
function saveProgress(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ECON));
}
function addGold(n){
  ECON.gold += n;
  updateGoldUI();
  saveProgress();
  flashToast(`+${n} gold 🪙`);
}
function spendGold(n){
  if(ECON.gold >= n){ ECON.gold -= n; updateGoldUI(); saveProgress(); return true; }
  return false;
}
function updateGoldUI(){
  goldText.textContent = ECON.gold;
  shopGoldText.textContent = ECON.gold;
}

/* ---- Shop UI ---- */
function openShop(){
  renderShop();
  shopModal.classList.remove('hidden');
}
function closeShop(){ shopModal.classList.add('hidden'); }
function renderShop(){
  shopGrid.innerHTML = '';
  SKINS.forEach(s=>{
    const item = document.createElement('div');
    item.className = 'shop-item';
    const left = document.createElement('div');
    left.className = 'shop-left';
    const sw = document.createElement('div');
    sw.className = 'skin-swatch';
    sw.style.setProperty('--bgc', s.glow + '22');
    sw.style.setProperty('--glow', s.glow + '66');
    sw.textContent = s.emoji;
    const info = document.createElement('div');
    info.innerHTML = `<div style="font-weight:700">${s.name}</div>
      <div class="muted">${s.price>0? `${s.price} gold` : 'Owned'}</div>`;
    left.append(sw, info);

    const right = document.createElement('div');
    const btn = document.createElement('button');
    btn.className = 'btn';
    const owned = !!ECON.ownedSkins[s.id];
    if(owned){
      btn.textContent = (ECON.selected===s.id) ? 'Selected' : 'Select';
      if(ECON.selected===s.id) btn.classList.add('btn-secondary');
      btn.onclick = ()=>{ applySkin(s.id); closeShop(); flashToast(`${s.name} equipped!`); };
    } else {
      btn.textContent = `Buy`;
      btn.onclick = ()=>{
        if(spendGold(s.price)){
          ECON.ownedSkins[s.id] = true;
          saveProgress();
          renderShop();
          flashToast(`Purchased ${s.name}!`);
        }else{
          flashToast(`Not enough gold for ${s.name}.`);
        }
      };
    }
    right.appendChild(btn);

    item.append(left, right);
    shopGrid.appendChild(item);
  });
}
function applySkin(id){
  const skin = SKINS.find(s=>s.id===id) || SKINS[0];
  dinoEmojiEl.textContent = skin.emoji;
  dinoEmojiEl.style.filter = `drop-shadow(0 0 10px ${skin.glow})`;
  ECON.selected = id;
  skinText.textContent = skin.name;
  saveProgress();
}

/* ---- Game state ---- */
const state = {
  running:true,
  dead:false,
  t:0, // ms
  speedMultiplier:1.0, // shown on HUD
  groundSpeed: 4, // base px per frame at 60fps
  gravity: 0.85, // for jump arc
  vy: 0,
  y: 0, // vertical offset
  duck: false,
  jetpacking:false,
  magnet:false,
  lastSpeedTick:0,
  spawnCd:0,
  puSpawnCd:5000,
  objects: new Set(),
  coins: new Set(),
};

function resetGame(){
  state.running = true;
  state.dead = false;
  state.t = 0;
  state.speedMultiplier = 1.0;
  state.vy = 0; state.y = 0; state.duck=false;
  setDinoState('run');
  dinoEl.classList.remove('jetpacking');
  gameEl.classList.remove('magnet-on');
  speedText.textContent = '1.0x';
  // clear objs
  for (const el of state.objects) el.remove();
  for (const el of state.coins) el.remove();
  state.objects.clear(); state.coins.clear();
  state.spawnCd = 1000; state.puSpawnCd = 4000; state.lastSpeedTick = 0;
  gameOverEl.classList.add('hidden');
  // reset yeho position visually
  yehoEl.style.transform = `translateX(0)`;
}

/* ---- Controls ---- */
// Jump
function tryJump(){
  if(state.dead) return;
  if(state.jetpacking) return; // jetpack ignores jump
  // Grounded if near y==0
  if(state.y===0){
    state.vy = 14; // jump impulse
    setDinoState('jump');
  }
}
btnJump.addEventListener('click', tryJump);
document.addEventListener('keydown', (e)=>{
  if(e.code==='Space' || e.key==='ArrowUp') { e.preventDefault(); tryJump(); }
  if(e.key==='ArrowDown'){ state.duck=true; setDinoState('duck'); }
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowDown'){ state.duck=false; if(state.y===0) setDinoState('run'); }
});

// Duck by holding Run button
btnRun.addEventListener('mousedown', ()=>{ state.duck=true; setDinoState('duck'); });
btnRun.addEventListener('touchstart', (e)=>{ e.preventDefault(); state.duck=true; setDinoState('duck'); }, {passive:false});
const endDuck = ()=>{ state.duck=false; if(state.y===0) setDinoState('run'); };
btnRun.addEventListener('mouseup', endDuck);
btnRun.addEventListener('mouseleave', endDuck);
btnRun.addEventListener('touchend', endDuck);

btnRestart.addEventListener('click', resetGame);
btnOverlayRestart.addEventListener('click', resetGame);

btnShop.addEventListener('click', openShop);
shopClose.addEventListener('click', closeShop);

/* ---- Helpers ---- */
function setDinoState(s){
  dinoEl.dataset.state = s;
}
function flashToast(msg){
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  clearTimeout(flashToast._t);
  flashToast._t = setTimeout(()=>{ toastEl.style.display='none'; }, 1300);
}

/* ---- Spawning ---- */
const OBSTACLES = ['rock','boulder','carpet'];

function spawnObstacle(){
  const kind = OBSTACLES[(Math.random()*OBSTACLES.length)|0];
  const el = document.createElement('div');
  el.className = `obstacle ${kind}`;
  el.dataset.kind = kind;
  gameEl.appendChild(el);
  state.objects.add(el);
}
function spawnPowerup(){
  const kind = Math.random()<0.5 ? 'jetpack' : 'magnet';
  const el = document.createElement('div');
  el.className = `powerup ${kind}`;
  el.dataset.kind = kind;
  el.textContent = kind==='jetpack' ? '✈️' : '🧲';
  // random height
  const base = 140 + Math.random()*60;
  el.style.bottom = `${base}px`;
  gameEl.appendChild(el);
  state.objects.add(el);
}
function spawnJetCoins(){
  // spawn a short trail of coins while jetpacking
  for(let i=0;i<5;i++){
    const c = document.createElement('div');
    c.className = 'float-coin';
    c.style.right = (-40 - i*30) + 'px';
    c.style.bottom = (140 + Math.random()*140) + 'px';
    gameEl.appendChild(c);
    state.coins.add(c);
  }
}

/* ---- Collision ---- */
function rect(el){
  return el.getBoundingClientRect();
}
function overlap(a,b){
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/* ---- Game Loop ---- */
let last = performance.now();
function frame(now){
  const dt = now - last; last = now;
  if(state.running && !state.dead){
    tick(dt);
  }
  requestAnimationFrame(frame);
}

function tick(dt){
  state.t += dt;

  // Speed scaling
  if(state.t - state.lastSpeedTick >= 10000){
    state.lastSpeedTick = state.t;
    state.speedMultiplier = +(state.speedMultiplier + 0.1).toFixed(1);
    speedText.textContent = state.speedMultiplier.toFixed(1) + 'x';
  }
  const move = state.groundSpeed * state.speedMultiplier;

  // Dino physics
  if(state.jetpacking){
    // Air steering with arrows; gentle gravity
    if(keys.Down) dinoEl.style.bottom = Math.max(120, Math.min(320, parseFloat(getComputedStyle(dinoEl).bottom) - 5)) + 'px';
    if(keys.Up)   dinoEl.style.bottom = Math.max(120, Math.min(320, parseFloat(getComputedStyle(dinoEl).bottom) + 5)) + 'px';
  }else{
    // Bottom = 90px + state.y
    if(state.vy>0 || state.y>0){
      state.y += state.vy;
      state.vy -= state.gravity*2; // arc tweak
      if(state.y<=0){ state.y=0; state.vy=0; setDinoState(state.duck?'duck':'run'); }
      dinoEl.style.bottom = (90 + state.y) + 'px';
    }else{
      dinoEl.style.bottom = '90px';
    }
  }

  // Background feel (move Yeho slightly forward as speed rises)
  yehoEl.style.transform = `translateX(${Math.min(60, (state.speedMultiplier-1)*30)}px)`;

  // Spawns
  state.spawnCd -= dt;
  if(state.spawnCd<=0){
    spawnObstacle();
    state.spawnCd = 800 + Math.random()*600;
    state.spawnCd /= state.speedMultiplier; // faster at high speed
  }
  state.puSpawnCd -= dt;
  if(state.puSpawnCd<=0){
    spawnPowerup();
    state.puSpawnCd = 5000 + Math.random()*5000;
  }
  // Occasional bonus coins during jetpack
  if(state.jetpacking && Math.random()<0.08) spawnJetCoins();

  // Move obstacles/powerups
  for(const el of [...state.objects]){
    const r = parseFloat(el.style.right || '0');
    el.style.right = (r + move) + 'px';

    // Remove off-screen
    if(r > gameEl.clientWidth + 120){
      el.remove();
      state.objects.delete(el);
      continue;
    }

    // Handle powerup pickup
    if(el.classList.contains('powerup')){
      if(overlap(rect(dinoEl), rect(el))){
        el.remove(); state.objects.delete(el);
        if(el.dataset.kind==='jetpack'){
          activateJetpack();
        }else{
          activateMagnet();
        }
      }
      continue;
    }

    // Obstacles logic
    const k = el.dataset.kind; // rock, boulder, carpet
    // collision zone ~ when overlapping horizontally
    if(overlap(rect(dinoEl), rect(el))){
      const jumping = state.y>12 || state.jetpacking;
      const ducking = state.duck && !state.jetpacking;
      let avoided = false;
      if(k==='rock'){ avoided = jumping; }
      else if(k==='boulder'){ avoided = ducking; }
      else if(k==='carpet'){ avoided = jumping || ducking; }

      if(state.magnet){
        // While magnet is on, obstacles harmless and fade out
        el.style.opacity = '0.2';
        // award normal gold only if "avoided" by action or jetpack flight over it
        if(avoided || state.jetpacking){ awardGoldFor(k); }
        el.remove(); state.objects.delete(el);
      }else{
        if(avoided){
          awardGoldFor(k);
          el.remove(); state.objects.delete(el);
        }else{
          // Trip => death
          return gameOver();
        }
      }
    }
  }

  // Move coins
  for(const c of [...state.coins]){
    const r = parseFloat(c.style.right || '0');
    c.style.right = (r + move*1.2) + 'px';
    if(r > gameEl.clientWidth + 120){ c.remove(); state.coins.delete(c); continue; }
    if(overlap(rect(dinoEl), rect(c))){
      addGold(5);
      c.remove(); state.coins.delete(c);
    }
  }
}

function awardGoldFor(kind){
  if(kind==='carpet') addGold(10);
  else addGold(20);
}

function gameOver(){
  state.dead = true;
  state.running = false;
  gameOverEl.classList.remove('hidden');
}

function activateJetpack(){
  if(state.jetpacking) return;
  state.jetpacking = true;
  dinoEl.classList.add('jetpacking');
  setDinoState('run');
  // raise off the ground
  dinoEl.style.bottom = '200px';
  flashToast('Jetpack ON ✈️ (5s)');
  const t = setTimeout(()=>{
    state.jetpacking = false;
    dinoEl.classList.remove('jetpacking');
    dinoEl.style.bottom = '90px';
    flashToast('Jetpack OFF');
  }, 5000);
}

function activateMagnet(){
  if(state.magnet) return;
  state.magnet = true;
  gameEl.classList.add('magnet-on');
  flashToast('Magnet ON 🧲 (5s)');
  setTimeout(()=>{
    state.magnet = false;
    gameEl.classList.remove('magnet-on');
    flashToast('Magnet OFF');
  }, 5000);
}

/* ---- Keyboard helpers ---- */
const keys = {Up:false, Down:false};
document.addEventListener('keydown', (e)=>{
  if(e.key==='ArrowUp') keys.Up = true;
  if(e.key==='ArrowDown') keys.Down = true;
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowUp') keys.Up = false;
  if(e.key==='ArrowDown') keys.Down = false;
});

/* ---- Bootstrap ---- */
loadProgress();
resetGame();
requestAnimationFrame(frame);
