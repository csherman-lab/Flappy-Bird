(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const REF_H = 600, GROUND_H = 72, PLAY_H = REF_H - GROUND_H;
  let W, H, S, refW;
  const PIPE_W = 72, BIRD_X = 100, BIRD_R = 16, MAX_FALL = 6, DRAG = 0.99;

  /* ═══ Difficulty presets ════════════════════════ */
  const DIFFS = {
    easy:   { gravity: 0.14, flapVel: -5.5, pipeGap: 210, baseSpeed: 1.8, pipeEvery: 120 },
    normal: { gravity: 0.18, flapVel: -6.2, pipeGap: 180, baseSpeed: 2.2, pipeEvery: 100 },
    hard:   { gravity: 0.25, flapVel: -6.5, pipeGap: 150, baseSpeed: 2.8, pipeEvery: 75 },
  };
  let difficulty = "normal";
  function D() { return DIFFS[difficulty]; }

  /* ═══ Bird skins ═══════════════════════════════ */
  const SKINS = {
    classic:  { name:"House Sparrow", body:["#f8ead2","#dfc39a","#a77b4c","#7b5534","#4d3524","#241a13"], outline:"rgba(43,27,17,0.42)", feather:"rgba(41,27,18,0.32)", chest:"#efe1c9", wing:["#7a4d2c","#5a3723","#2c2118"], wingHi:"#cfaa76", tail:["#2b2018","#5b3a25","#8d5d35"], tailHi:"rgba(232,197,145,0.18)", iris:"#18100a", beakUp:"#6a4328", beakLo:"#3e2619" },
    cardinal: { name:"Northern Cardinal", body:["#f8d6d0","#c84a3e","#9e2f2c","#6d2322","#441817","#1d0e0e"], outline:"rgba(55,16,14,0.45)", feather:"rgba(60,15,12,0.32)", chest:"#e7aaa0", wing:["#8b2726","#661c1d","#2b1112"], wingHi:"#d36a5a", tail:["#2e1011","#5d1b1c","#8f2b29"], tailHi:"rgba(238,117,97,0.18)", iris:"#120b09", beakUp:"#d28b62", beakLo:"#8a5134" },
    bluebird: { name:"Eastern Bluebird", body:["#f4d7b6","#c88755","#5d86a8","#365f82","#213f5c","#111d2c"], outline:"rgba(13,30,45,0.44)", feather:"rgba(20,43,62,0.3)", chest:"#df9a62", wing:["#355f82","#274864","#172638"], wingHi:"#8fb2c8", tail:["#172638","#234360","#3d6f95"], tailHi:"rgba(154,190,210,0.18)", iris:"#120f0d", beakUp:"#5c3823", beakLo:"#342015" },
    parrot:   { name:"Green Parakeet", body:["#e4ecc5","#a7b872","#668a45","#426638","#253e27","#111e15"], outline:"rgba(17,45,23,0.42)", feather:"rgba(24,61,31,0.3)", chest:"#d7e0b0", wing:["#52733e","#34532f","#172817"], wingHi:"#bdc987", tail:["#182a18","#335131","#55783d"], tailHi:"rgba(199,213,142,0.18)", iris:"#10120a", beakUp:"#c99d67", beakLo:"#7a5634" },
    phoenix:  { name:"Rufous Hummingbird", body:["#fae2bd","#c78b4a","#a65e2d","#6b341e","#3d2118","#1c100d"], outline:"rgba(58,30,18,0.45)", feather:"rgba(65,32,18,0.32)", chest:"#f1ca96", wing:["#70442d","#3f2a22","#17100d"], wingHi:"#d39a5f", tail:["#201411","#5a3021","#8f502d"], tailHi:"rgba(238,166,92,0.18)", iris:"#100a07", beakUp:"#3b2b22", beakLo:"#211712" },
    frost:    { name:"Snow Bunting", body:["#f9f6ed","#e2dac9","#b5afa2","#76766f","#383a38","#141615"], outline:"rgba(31,34,34,0.4)", feather:"rgba(47,50,48,0.28)", chest:"#f2eadc", wing:["#d8d1c0","#706f68","#1c1f1f"], wingHi:"#fff8e9", tail:["#161819","#4a4d4a","#cbc3b2"], tailHi:"rgba(255,250,235,0.2)", iris:"#0b0b09", beakUp:"#b38c62", beakLo:"#65442b" },
  };
  let selectedSkin = "classic";

  /* ═══ DOM refs ═════════════════════════════════ */
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best-score");
  const statusEl = document.getElementById("status");
  const muteBtn = document.getElementById("mute");
  const menuBestEl = document.getElementById("menu-best");
  const menuBestWrap = document.getElementById("menu-best-wrap");

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);

  function makeTexture(size, palette, strokes = 14) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = palette[(Math.random() * palette.length) | 0];
      const jitter = (Math.random() * 34 - 17) | 0;
      img.data[i] = clamp(p[0] + jitter, 0, 255);
      img.data[i + 1] = clamp(p[1] + jitter, 0, 255);
      img.data[i + 2] = clamp(p[2] + jitter, 0, 255);
      img.data[i + 3] = clamp(p[3] * (0.35 + Math.random() * 0.65), 0, 255);
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < strokes; i++) {
      g.globalAlpha = 0.08 + Math.random() * 0.1;
      g.strokeStyle = Math.random() > 0.5 ? "#fff" : "#000";
      g.lineWidth = 0.5 + Math.random();
      const y = Math.random() * size;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(size * 0.35, y + rand(-8, 8), size * 0.7, y + rand(-8, 8), size, y + rand(-4, 4));
      g.stroke();
    }
    return ctx.createPattern(c, "repeat");
  }

  const TEX = {
    sky: makeTexture(96, [[92,116,132,22],[255,235,198,16],[28,43,56,18]], 10),
    metal: makeTexture(88, [[21,35,31,96],[79,67,48,84],[113,78,48,74],[36,91,75,70],[214,171,105,30]], 24),
    soil: makeTexture(88, [[20,15,10,120],[72,54,35,88],[43,68,34,70],[160,130,86,36]], 22),
    grain: makeTexture(128, [[255,255,255,36],[0,0,0,42]], 4),
  };

  /* ═══ Preferences ══════════════════════════════ */
  let sfxOn = true, musicOn = true, muted = false;

  function savePrefs() {
    localStorage.setItem("flappy-prefs", JSON.stringify({ skin: selectedSkin, diff: difficulty, sfx: sfxOn, music: musicOn }));
  }
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem("flappy-prefs"));
      if (p) {
        if (SKINS[p.skin]) selectedSkin = p.skin;
        if (DIFFS[p.diff]) difficulty = p.diff;
        if (typeof p.sfx === "boolean") sfxOn = p.sfx;
        if (typeof p.music === "boolean") musicOn = p.music;
      }
    } catch (_) {}
  }

  /* ═══ Audio ════════════════════════════════════ */
  let ac = null, musicTimeout = null, musicPlaying = false;
  function audio() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); return ac; }

  function playFlap() {
    if (muted || !sfxOn) return;
    try { const a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(340, t); o.frequency.linearRampToValueAtTime(520, t + 0.04); o.frequency.linearRampToValueAtTime(360, t + 0.1);
      g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.12); } catch (_) {}
  }
  function playPoint() {
    if (muted || !sfxOn) return;
    try { const a = audio(), t = a.currentTime;
      [523,659,784].forEach((f,i) => { const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, t+i*0.065); g.gain.linearRampToValueAtTime(0.06, t+i*0.065+0.015); g.gain.exponentialRampToValueAtTime(0.001, t+i*0.065+0.22);
        o.connect(g).connect(a.destination); o.start(t+i*0.065); o.stop(t+i*0.065+0.22); }); } catch (_) {}
  }
  function playHit() {
    if (muted || !sfxOn) return;
    try { const a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t+0.22);
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.25);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t+0.25);
      const len = a.sampleRate*0.08|0, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
      const n = a.createBufferSource(), ng = a.createGain(); n.buffer = buf;
      ng.gain.setValueAtTime(0.06, t); ng.gain.exponentialRampToValueAtTime(0.001, t+0.1);
      n.connect(ng).connect(a.destination); n.start(t); } catch (_) {}
  }
  function playSwoosh() {
    if (muted || !sfxOn) return;
    try { const a = audio(), t = a.currentTime, len = a.sampleRate*0.1|0, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len)*0.25;
      const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      n.buffer = buf; f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 1.5; g.gain.value = 0.04;
      n.connect(f).connect(g).connect(a.destination); n.start(t); } catch (_) {}
  }
  function playCoin() {
    if (muted||!sfxOn) return;
    try { const a=audio(),t=a.currentTime;
      [880,1320].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.type="sine";o.frequency.value=f;
        g.gain.setValueAtTime(0.07,t+i*0.06);g.gain.exponentialRampToValueAtTime(0.001,t+i*0.06+0.12);
        o.connect(g).connect(a.destination);o.start(t+i*0.06);o.stop(t+i*0.06+0.12);}); } catch(_) {}
  }

  const ML = [[523,0.5],[587,0.5],[659,1],[784,0.5],[659,0.5],[587,1],[523,0.5],[0,0.5],[784,0.5],[659,0.5],[587,1],[523,0.5],[587,0.5],[659,1],[0,1],[440,0.5],[523,0.5],[587,0.5],[659,0.5],[523,1],[587,1],[523,1],[0,1]];
  const BL = [[262,4],[294,4],[220,4],[262,4]];
  function playMusicLoop() {
    if (muted || !musicOn || !musicPlaying) return;
    try { const a = audio(), beat = 60/130; let t = a.currentTime+0.05, dur = 0;
      for (const [freq, b] of ML) { if (freq>0) { const o=a.createOscillator(),g=a.createGain(); o.type="triangle"; o.frequency.value=freq; const nd=beat*b;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.022,t+0.015); g.gain.setValueAtTime(0.022,t+nd*0.75); g.gain.linearRampToValueAtTime(0,t+nd);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t+nd); } t+=beat*b; dur+=beat*b; }
      t = a.currentTime+0.05;
      for (const [freq, b] of BL) { if (freq>0) { const o=a.createOscillator(),g=a.createGain(); o.type="sine"; o.frequency.value=freq; const nd=beat*b;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.015,t+0.02); g.gain.setValueAtTime(0.015,t+nd*0.8); g.gain.linearRampToValueAtTime(0,t+nd);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t+nd); } t+=beat*b; }
      musicTimeout = setTimeout(playMusicLoop, (dur-0.1)*1000); } catch (_) {}
  }
  function startMusic() { if (musicPlaying) return; musicPlaying = true; playMusicLoop(); }
  function stopMusic() { musicPlaying = false; if (musicTimeout) { clearTimeout(musicTimeout); musicTimeout = null; } }

  /* ═══ Menu system ══════════════════════════════ */
  let menuVisible = true;
  function showScreen(id) {
    ["menu-screen","bird-screen","settings-screen"].forEach(s => document.getElementById(s).hidden = (id !== s));
    document.getElementById("hud").hidden = (id !== null);
    document.getElementById("gameover-btns").hidden = true;
    menuVisible = (id !== null);
  }

  function populateBirdGrid() {
    const grid = document.getElementById("bird-grid"); grid.innerHTML = "";
    for (const [id, sk] of Object.entries(SKINS)) {
      const card = document.createElement("div");
      card.className = "bird-card" + (id === selectedSkin ? " selected" : "");
      card.dataset.skin = id;
      card.innerHTML = `<div class="bird-dot" style="background:radial-gradient(circle at 35% 35%,${sk.body[1]},${sk.body[2]},${sk.body[5]})"></div><span>${sk.name}</span>`;
      card.addEventListener("click", () => {
        selectedSkin = id; savePrefs();
        grid.querySelectorAll(".bird-card").forEach(c => c.classList.toggle("selected", c.dataset.skin === id));
      });
      grid.appendChild(card);
    }
  }

  function syncSettingsUI() {
    document.getElementById("set-sound").checked = sfxOn;
    document.getElementById("set-music").checked = musicOn;
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.toggle("active", b.dataset.diff === difficulty));
  }

  /* ═══ State ════════════════════════════════════ */
  let bird, pipes, particles, clouds, motes, stars, demoPipes;
  let tick, frame, score, bestScore, state;
  let shakeX, shakeY, shakeT, groundOff, fadeAlpha, deathT, scorePulse, flashAlpha, farOff, nearOff;
  let coins=[], trails=[], streak=0, maxStreak=0, gameStartTick=0, paused=false;
  let powerups=[], shieldActive=false, slowmoTimer=0;
  const MILESTONES={10:"NICE!",20:"GREAT!",30:"AMAZING!",50:"LEGENDARY!",75:"GODLIKE!"};

  bestScore = +localStorage.getItem("flappy-best") || 0;
  bestEl.textContent = bestScore;
  if (menuBestEl) { menuBestEl.textContent = bestScore; if (menuBestWrap) menuBestWrap.hidden = bestScore === 0; }

  function speed() { return D().baseSpeed * (1 + score * 0.005); }
  function dayPhase() { return (score % 60) / 60; }

  function init() {
    bird = { y: PLAY_H / 2, vy: 0, wing: 0, tilt: 0 };
    pipes = []; particles = [];
    tick = frame = score = 0; state = "idle";
    shakeX = shakeY = shakeT = groundOff = fadeAlpha = deathT = scorePulse = flashAlpha = 0;
    farOff = nearOff = 0; coins=[]; trails=[]; streak=0; maxStreak=0; gameStartTick=0; paused=false; powerups=[]; shieldActive=false; slowmoTimer=0;
    scoreEl.textContent = "0";
    statusEl.textContent = "";
    document.getElementById("gameover-btns").hidden = true;
    stopMusic(); initDemoPipes();
  }
  function initClouds() { clouds = []; const w = refW||700; for (let i=0;i<12;i++) clouds.push({x:rand(-80,w+200),y:rand(20,PLAY_H*0.42),w:rand(85,210),h:rand(30,68),speed:rand(0.04,0.22),alpha:rand(0.12,0.34),blur:rand(0.8,3.8),warm:Math.random()>0.45}); }
  function initMotes() { motes = []; const w = refW||700; for (let i=0;i<70;i++) motes.push({x:rand(0,w),y:rand(15,PLAY_H*0.88),size:rand(0.35,1.8),sx:rand(0.02,0.13),sy:rand(-0.05,0.06),phase:rand(0,Math.PI*2),alpha:rand(0.06,0.22)}); }
  function initStars() { stars = []; for (let i=0;i<90;i++) stars.push({x:rand(0,1),y:rand(0,0.6),size:rand(0.5,2),tw:rand(0,Math.PI*2)}); }
  function initDemoPipes() { demoPipes = []; const w = refW||700; for (let i=0;i<4;i++) demoPipes.push({x:w*0.3+i*280,gapY:rand(140,PLAY_H-140),gap:D().pipeGap}); }
  function resize() { W=window.innerWidth; H=window.innerHeight; canvas.width=W; canvas.height=H; S=H/REF_H; refW=W/S; }

  /* ═══ Particles ════════════════════════════════ */
  function spawnFeathers(x,y) { const pal=["#facc15","#fbbf24","#f59e0b","#fb923c","#fef9c3"]; for (let i=0;i<16;i++) particles.push({type:"feather",x,y,vx:rand(-4,4),vy:rand(-6,-0.5),rot:rand(0,Math.PI*2),vrot:rand(-0.18,0.18),life:1,size:rand(3,9),color:pal[~~rand(0,5)]}); }
  function spawnSparkle(x,y) { for (let i=0;i<10;i++){const a=rand(0,Math.PI*2),s=rand(1.5,5); particles.push({type:"sparkle",x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,size:rand(2,5),color:"#fff"});} }
  function spawnPopup(x,y) { particles.push({type:"text",x,y,vy:-1.5,life:1,text:"+1"}); }
  function updateParticles() { for (let i=particles.length-1;i>=0;i--){const p=particles[i]; if(p.type==="feather"){p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.vx*=0.99;p.rot+=p.vrot;p.life-=0.008;} else if(p.type==="sparkle"){p.x+=p.vx;p.y+=p.vy;p.life-=0.026;} else{p.y+=p.vy;p.life-=0.018;} if(p.life<=0)particles.splice(i,1);} }

  /* ═══ Coins & Trails ════════════════════════════ */
  function updateCoins(spd) {
    for(let i=coins.length-1;i>=0;i--){const c=coins[i];c.x-=spd;
      if(!c.collected){const dx=BIRD_X-c.x,dy=bird.y-c.y;if(dx*dx+dy*dy<400){c.collected=true;score+=2;scoreEl.textContent=score;scorePulse=0.8;spawnSparkle(c.x,c.y);particles.push({type:"text",x:c.x,y:c.y-10,vy:-1.5,life:1,text:"+2"});playCoin();}}
      if(c.x<-20)coins.splice(i,1);}
  }
  function spawnTrail() {
    if(state!=="running"||tick%3!==0)return;const sk=SKINS[selectedSkin];
    trails.push({x:BIRD_X-BIRD_R*0.8,y:bird.y+rand(-3,3),size:rand(2,5),life:1,color:sk.body[2]});
  }
  function updateTrails(){for(let i=trails.length-1;i>=0;i--){trails[i].life-=0.04;if(trails[i].life<=0)trails.splice(i,1);}}
  function updatePowerups(spd){for(let i=powerups.length-1;i>=0;i--){const pu=powerups[i];pu.x-=spd;if(!pu.collected){const dx=BIRD_X-pu.x,dy=bird.y-pu.y;if(dx*dx+dy*dy<500){pu.collected=true;if(pu.type==="shield")shieldActive=true;else slowmoTimer=300;spawnSparkle(pu.x,pu.y);playCoin();}}if(pu.x<-20)powerups.splice(i,1);}}
  function checkMilestone(){if(MILESTONES[score]){particles.push({type:"text",x:refW/2,y:PLAY_H/3,vy:-0.6,life:1.5,text:MILESTONES[score],big:true});for(let i=0;i<15;i++){const a=rand(0,Math.PI*2),s=rand(2,6);particles.push({type:"sparkle",x:refW/2,y:PLAY_H/3,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,size:rand(2,5),color:"#fbbf24"});}}}

  /* ═══ Pipes ════════════════════════════════════ */
  function addPipe(){const g=D().pipeGap,m=70,lo=m+g/2,hi=PLAY_H-m-g/2,px=refW+20,gy=rand(lo,hi);const mv=score>=15&&Math.random()<0.25;pipes.push({x:px,gapY:gy,gap:g,passed:false,moving:mv,baseY:gy,movePhase:rand(0,Math.PI*2)});if(Math.random()<0.4)coins.push({x:px+PIPE_W/2,y:gy,collected:false});if(Math.random()<0.12)powerups.push({x:px+PIPE_W/2,y:gy+rand(-30,30),type:Math.random()<0.5?"shield":"slowmo",collected:false});}
  function collides(p) { const hr=BIRD_R-2; if(BIRD_X+hr<=p.x||BIRD_X-hr>=p.x+PIPE_W)return false; const gT=p.gapY-p.gap/2,gB=p.gapY+p.gap/2; return bird.y-hr<gT||bird.y+hr>gB; }

  /* ═══ Update ═══════════════════════════════════ */
  function update() {
    tick++; bird.wing += state==="running"?0.2:0.1;
    if (paused) return;
    if (scorePulse>0) scorePulse-=0.04;
    if (flashAlpha>0) flashAlpha-=0.025;
    if (shakeT>0){shakeT--;shakeX=(Math.random()-0.5)*shakeT*1.2;shakeY=(Math.random()-0.5)*shakeT*1.2;}else{shakeX=shakeY=0;}
    updateParticles();
    for (const c of clouds){c.x-=c.speed;if(c.x+c.w<-50){c.x=refW+rand(20,160);c.y=rand(20,PLAY_H*0.42);}}
    for (const m of motes){m.x+=m.sx+Math.sin(tick*0.018+m.phase)*0.12;m.y+=m.sy+Math.cos(tick*0.013+m.phase)*0.08;if(m.x>refW+10)m.x=-5;if(m.y<-5||m.y>PLAY_H+5)m.y=rand(15,PLAY_H*0.88);}

    if (state==="idle") {
      bird.y=PLAY_H/2+Math.sin(tick*0.032)*14; bird.tilt=Math.sin(tick*0.032)*0.1;
      groundOff=(groundOff+0.7)%32; farOff+=0.15; nearOff+=0.25;
      for (const dp of demoPipes){dp.x-=0.7;if(dp.x+PIPE_W<-20){dp.x=refW+rand(40,120);dp.gapY=rand(140,PLAY_H-140);}} return;
    }
    if (state==="dying") {
      bird.vy+=D().gravity*0.8;bird.y+=bird.vy;bird.tilt=Math.min(bird.tilt+0.07,Math.PI*0.55);deathT++;
      if (bird.y+BIRD_R>=PLAY_H||deathT>80){bird.y=Math.min(bird.y,PLAY_H-BIRD_R);state="over";
        document.getElementById("gameover-btns").hidden=false; statusEl.textContent="Game Over";
        if(score>bestScore){bestScore=score;bestEl.textContent=bestScore;localStorage.setItem("flappy-best",bestScore);if(menuBestEl){menuBestEl.textContent=bestScore;if(menuBestWrap)menuBestWrap.hidden=false;}}
      } return;
    }
    if (state==="over"){fadeAlpha=Math.min(fadeAlpha+0.025,0.72);return;}

    frame++;const rawSpd=speed(),spd=rawSpd*(slowmoTimer>0?0.4:1);groundOff=(groundOff+spd)%32; farOff+=spd*0.12; nearOff+=spd*0.25;
    const grav=D().gravity*(slowmoTimer>0?0.5:1);bird.vy+=grav;bird.vy*=DRAG; bird.vy=clamp(bird.vy,-MAX_FALL,MAX_FALL); bird.y+=bird.vy;
    bird.tilt=lerp(bird.tilt,clamp(bird.vy/10,-0.4,Math.PI/4.5),0.08);
    if(bird.y-BIRD_R<=0||bird.y+BIRD_R>=PLAY_H){die();return;}
    if(frame%D().pipeEvery===0)addPipe();
    if(slowmoTimer>0)slowmoTimer--;spawnTrail();updateTrails();updateCoins(spd);updatePowerups(spd);
    for(let i=pipes.length-1;i>=0;i--){const p=pipes[i];p.x-=spd;if(p.moving)p.gapY=p.baseY+Math.sin(tick*0.02+p.movePhase)*30;
      if(!p.passed&&p.x+PIPE_W<BIRD_X-BIRD_R){p.passed=true;score++;streak++;if(streak>maxStreak)maxStreak=streak;scoreEl.textContent=score;scorePulse=1;spawnSparkle(BIRD_X,bird.y-25);
        if(streak>1){particles.push({type:"text",x:BIRD_X+30,y:bird.y-20,vy:-1.8,life:1,text:"x"+streak+"!"});}else{spawnPopup(BIRD_X+25,bird.y-15);}
        checkMilestone();playPoint();playSwoosh();}
      if(collides(p)){if(shieldActive){shieldActive=false;shakeT=8;spawnSparkle(BIRD_X,bird.y);playHit();}else{die();return;}} if(p.x+PIPE_W<-20)pipes.splice(i,1);}
  }
  function die(){state="dying";deathT=0;shakeT=16;flashAlpha=0.35;streak=0;shieldActive=false;spawnFeathers(BIRD_X,bird.y);playHit();stopMusic();}
  function flap(){
    if(state==="over"||state==="dying")return;
    if(ac&&ac.state==="suspended")ac.resume();
    if(state==="idle"){state="running";statusEl.textContent="";gameStartTick=tick;startMusic();}
    bird.vy=D().flapVel; playFlap();
  }

  /* ═══════════════ DRAWING ══════════════════════ */
  function drawSky(){const g=ctx.createLinearGradient(0,0,0,PLAY_H);g.addColorStop(0,"#597e98");g.addColorStop(0.25,"#83a8bb");g.addColorStop(0.55,"#b7bdad");g.addColorStop(0.82,"#c7a87d");g.addColorStop(1,"#7a6349");ctx.fillStyle=g;ctx.fillRect(0,0,refW,PLAY_H);ctx.save();ctx.globalCompositeOperation="soft-light";ctx.globalAlpha=0.32;ctx.fillStyle=TEX.sky;ctx.fillRect(0,0,refW,PLAY_H);ctx.restore();}
  function drawHaze(){const hz=ctx.createLinearGradient(0,PLAY_H*0.48,0,PLAY_H);hz.addColorStop(0,"rgba(246,228,190,0)");hz.addColorStop(0.42,"rgba(226,206,169,0.16)");hz.addColorStop(0.78,"rgba(165,130,87,0.24)");hz.addColorStop(1,"rgba(80,65,48,0.34)");ctx.fillStyle=hz;ctx.fillRect(0,PLAY_H*0.48,refW,PLAY_H*0.52);}
  function drawSun(){const sx=refW-88,sy=88;const g1=ctx.createRadialGradient(sx,sy,5,sx,sy,190);g1.addColorStop(0,"rgba(255,238,194,0.72)");g1.addColorStop(0.14,"rgba(238,197,128,0.32)");g1.addColorStop(0.42,"rgba(203,141,82,0.12)");g1.addColorStop(1,"rgba(203,141,82,0)");ctx.fillStyle=g1;ctx.fillRect(0,0,refW,PLAY_H);const dg=ctx.createRadialGradient(sx-4,sy-4,2,sx,sy,24);dg.addColorStop(0,"#fff9e5");dg.addColorStop(0.38,"#f1d79d");dg.addColorStop(1,"rgba(199,139,76,0.1)");ctx.fillStyle=dg;ctx.beginPath();ctx.arc(sx,sy,24,0,Math.PI*2);ctx.fill();}

  function drawDayNight(){if(state!=="running"&&state!=="dying")return;const p=dayPhase();if(p>0.15&&p<0.45){ctx.fillStyle=`rgba(234,88,12,${Math.sin(((p-0.15)/0.3)*Math.PI)*0.22})`;ctx.fillRect(0,0,refW,PLAY_H);}if(p>0.35&&p<0.75){const t=(p-0.35)/0.4,ni=Math.sin(t*Math.PI);ctx.fillStyle=`rgba(15,10,40,${ni*0.55})`;ctx.fillRect(0,0,refW,PLAY_H);if(ni>0.25){ctx.save();for(const s of stars){ctx.globalAlpha=ni*(0.4+0.6*Math.sin(tick*0.04+s.tw))*0.7;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s.x*refW,s.y*PLAY_H,s.size,0,Math.PI*2);ctx.fill();}ctx.restore();}if(ni>0.4){const mx=refW*0.2,my=85;ctx.save();ctx.globalAlpha=ni;const mg=ctx.createRadialGradient(mx,my,8,mx,my,55);mg.addColorStop(0,"rgba(226,232,240,0.25)");mg.addColorStop(1,"rgba(226,232,240,0)");ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,55,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e2e8f0";ctx.beginPath();ctx.arc(mx,my,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(148,163,184,0.3)";ctx.beginPath();ctx.arc(mx-5,my-4,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(mx+6,my+3,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(mx-2,my+7,2.5,0,Math.PI*2);ctx.fill();ctx.restore();}}if(p>0.65&&p<0.9){ctx.fillStyle=`rgba(219,39,119,${Math.sin(((p-0.65)/0.25)*Math.PI)*0.1})`;ctx.fillRect(0,0,refW,PLAY_H);}}

  function drawCloudShape(x,y,w,h){ctx.beginPath();const r=h*0.5;ctx.arc(x+w*0.12,y+r*0.15,r*0.8,0,Math.PI*2);ctx.arc(x+w*0.28,y-r*0.1,r*1.1,0,Math.PI*2);ctx.arc(x+w*0.46,y-r*0.5,r*1.35,0,Math.PI*2);ctx.arc(x+w*0.64,y-r*0.15,r*1.15,0,Math.PI*2);ctx.arc(x+w*0.8,y+r*0.1,r*0.9,0,Math.PI*2);ctx.arc(x+w*0.36,y+r*0.3,r,0,Math.PI*2);ctx.arc(x+w*0.58,y+r*0.25,r*1.05,0,Math.PI*2);ctx.fill();}
  function drawClouds(){for(const c of clouds){ctx.save();ctx.filter=`blur(${c.blur}px)`;ctx.globalAlpha=c.alpha;ctx.fillStyle="rgba(64,74,80,0.18)";drawCloudShape(c.x+5,c.y+8,c.w,c.h);const cg=ctx.createLinearGradient(c.x,c.y-c.h*0.6,c.x,c.y+c.h*0.7);cg.addColorStop(0,c.warm?"#f4efe3":"#e5edf0");cg.addColorStop(0.48,c.warm?"#dad4c8":"#d3dde2");cg.addColorStop(1,c.warm?"#a99f8c":"#9aa9ad");ctx.fillStyle=cg;drawCloudShape(c.x,c.y,c.w,c.h);ctx.globalAlpha=c.alpha*0.28;ctx.fillStyle="rgba(255,239,200,0.55)";drawCloudShape(c.x+2,c.y-3,c.w*0.86,c.h*0.55);ctx.restore();}}
  function drawMotes(){for(const m of motes){const pulse=0.5+0.5*Math.sin(tick*0.025+m.phase);ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=m.alpha*(0.55+0.45*pulse);ctx.fillStyle="#f8e6bd";ctx.beginPath();ctx.arc(m.x,m.y,m.size,0,Math.PI*2);ctx.fill();ctx.restore();}}

  function drawHills(){for(let layer=0;layer<3;layer++){const off=layer===0?farOff*0.5:layer===1?farOff:nearOff,base=PLAY_H-(76-layer*24),alpha=[0.24,0.32,0.42][layer];ctx.save();ctx.globalAlpha=alpha;ctx.filter=`blur(${[2.2,1.2,0.4][layer]}px)`;const fg=ctx.createLinearGradient(0,base-70,0,PLAY_H);fg.addColorStop(0,["#536a5a","#405840","#253b2e"][layer]);fg.addColorStop(1,["#26382f","#213426","#142219"][layer]);ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(0,PLAY_H);for(let x=-20;x<=refW+20;x+=8){const sx=x+off;const y=base+Math.sin(sx*0.012+layer)*22+Math.sin(sx*0.027)*9-Math.abs(Math.sin(sx*0.11))*18;ctx.lineTo(x,y);}ctx.lineTo(refW,PLAY_H);ctx.fill();ctx.restore();}ctx.save();ctx.globalAlpha=0.25;ctx.fillStyle="#16251b";for(let x=-20-(nearOff%56);x<refW+60;x+=28){const h=44+Math.sin(x*0.12)*18;ctx.beginPath();ctx.moveTo(x,PLAY_H-8);ctx.lineTo(x+9,PLAY_H-h);ctx.lineTo(x+20,PLAY_H-8);ctx.closePath();ctx.fill();}ctx.restore();}

  function drawGround(){const y=PLAY_H;const dg=ctx.createLinearGradient(0,y,0,REF_H);dg.addColorStop(0,"#3c4d2d");dg.addColorStop(0.12,"#56633a");dg.addColorStop(0.22,"#4a3724");dg.addColorStop(0.55,"#2d2218");dg.addColorStop(1,"#130e0a");ctx.fillStyle=dg;ctx.fillRect(0,y,refW,GROUND_H);ctx.save();ctx.globalCompositeOperation="multiply";ctx.globalAlpha=0.46;ctx.fillStyle=TEX.soil;ctx.fillRect(0,y,refW,GROUND_H);ctx.restore();ctx.strokeStyle="rgba(230,199,144,0.12)";ctx.lineWidth=1;for(let sy=y+18;sy<REF_H-8;sy+=12){ctx.beginPath();ctx.moveTo(0,sy);for(let sx=0;sx<=refW;sx+=18)ctx.lineTo(sx,sy+Math.sin(sx*0.07+sy)*1.4);ctx.stroke();}for(let i=0;i<28;i++){const rx=(i*47+11+groundOff*0.35)%Math.max(refW,1),ry=y+18+(i*23)%(GROUND_H-26),rs=1.1+(i*13)%3;const rg=ctx.createRadialGradient(rx-0.5,ry-0.5,0,rx,ry,rs*1.6);rg.addColorStop(0,"rgba(176,153,118,0.3)");rg.addColorStop(1,"rgba(26,20,15,0.28)");ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(rx,ry,rs*1.6,rs,i*0.5,0,Math.PI*2);ctx.fill();}const gg=ctx.createLinearGradient(0,y-10,0,y+16);gg.addColorStop(0,"#8f9b60");gg.addColorStop(0.3,"#566b3e");gg.addColorStop(0.72,"#283f2b");gg.addColorStop(1,"#172719");ctx.fillStyle=gg;ctx.fillRect(0,y-3,refW,18);const gp=["#8f9b60","#637747","#3e5b37","#223622"];for(let ci=0;ci<4;ci++){ctx.strokeStyle=gp[ci];ctx.lineWidth=0.9+ci*0.12;ctx.beginPath();for(let gx=-groundOff+ci*2.5;gx<refW+20;gx+=9){const h=8+Math.sin(gx*0.7)*4+Math.cos(gx*1.3)*2,bend=Math.sin(gx*0.25+tick*0.012)*2.8;ctx.moveTo(gx,y-1);ctx.quadraticCurveTo(gx+bend*0.45,y-h*0.62,gx+bend,y-h);}ctx.stroke();}}

  function drawPipeBody(x,y,w,h){if(h<=0)return;const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,"#101816");g.addColorStop(0.08,"#294c42");g.addColorStop(0.2,"#5f704f");g.addColorStop(0.34,"#8a6239");g.addColorStop(0.48,"#b37a43");g.addColorStop(0.58,"#6e7c55");g.addColorStop(0.75,"#31594c");g.addColorStop(0.92,"#172a25");g.addColorStop(1,"#090f0d");ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.save();ctx.globalCompositeOperation="multiply";ctx.globalAlpha=0.5;ctx.fillStyle=TEX.metal;ctx.fillRect(x,y,w,h);ctx.restore();ctx.fillStyle="rgba(246,218,165,0.18)";ctx.fillRect(x+w*0.38,y,2,h);ctx.fillStyle="rgba(255,245,210,0.08)";ctx.fillRect(x+w*0.2,y,w*0.045,h);ctx.fillStyle="rgba(0,0,0,0.28)";ctx.fillRect(x+w-3,y,3,h);ctx.fillStyle="rgba(0,0,0,0.16)";ctx.fillRect(x,y,2,h);ctx.strokeStyle="rgba(21,23,18,0.42)";ctx.lineWidth=1.4;const seam=x+w*0.72;ctx.beginPath();ctx.moveTo(seam,y);for(let yy=y;yy<y+h;yy+=18)ctx.lineTo(seam+Math.sin(yy*0.08)*1.2,yy);ctx.stroke();ctx.globalAlpha=0.36;for(let si=0;si<5;si++){const sx=x+w*(0.12+si*0.18);ctx.strokeStyle=si%2?"#16231d":"#8f6a3f";ctx.lineWidth=0.55;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+Math.sin(si)*1.5,y+h);ctx.stroke();}ctx.globalAlpha=1;}
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();}
  function drawPipeCap(x,y,w,h){const r=6;ctx.fillStyle="rgba(0,0,0,0.24)";roundRect(x+3,y+4,w,h,r);const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,"#0c1412");g.addColorStop(0.1,"#2a4f45");g.addColorStop(0.26,"#7a7145");g.addColorStop(0.42,"#b3844d");g.addColorStop(0.56,"#d1a266");g.addColorStop(0.72,"#5f7653");g.addColorStop(0.88,"#214136");g.addColorStop(1,"#08110e");ctx.fillStyle=g;roundRect(x,y,w,h,r);ctx.save();ctx.globalCompositeOperation="multiply";ctx.globalAlpha=0.42;ctx.fillStyle=TEX.metal;ctx.fillRect(x,y,w,h);ctx.restore();ctx.fillStyle="rgba(255,236,187,0.16)";ctx.fillRect(x+r,y+3,w-r*2,2);ctx.fillStyle="rgba(0,0,0,0.2)";ctx.fillRect(x+r,y+h-4,w-r*2,4);for(let rx=x+12;rx<x+w-8;rx+=13){const bg=ctx.createRadialGradient(rx-0.8,y+h*0.5-0.8,0,rx,y+h*0.5,3.4);bg.addColorStop(0,"#e3b875");bg.addColorStop(0.45,"#6f4d32");bg.addColorStop(1,"#14100d");ctx.fillStyle=bg;ctx.beginPath();ctx.arc(rx,y+h*0.5,2.7,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.35)";ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(rx-1.7,y+h*0.5);ctx.lineTo(rx+1.7,y+h*0.5);ctx.stroke();}}
  function drawPipe(p){const g=p.gap||D().pipeGap,gT=p.gapY-g/2,gB=p.gapY+g/2,capH=30,ovr=8;drawPipeBody(p.x,0,PIPE_W,gT-capH);drawPipeCap(p.x-ovr,gT-capH,PIPE_W+ovr*2,capH);drawPipeBody(p.x,gB+capH,PIPE_W,PLAY_H-gB-capH);drawPipeCap(p.x-ovr,gB,PIPE_W+ovr*2,capH);let ti=ctx.createLinearGradient(0,gT,0,gT-12);ti.addColorStop(0,"rgba(5,12,9,0.48)");ti.addColorStop(1,"rgba(5,12,9,0)");ctx.fillStyle=ti;ctx.fillRect(p.x+4,gT-12,PIPE_W-8,12);ti=ctx.createLinearGradient(0,gB,0,gB+12);ti.addColorStop(0,"rgba(5,12,9,0.48)");ti.addColorStop(1,"rgba(5,12,9,0)");ctx.fillStyle=ti;ctx.fillRect(p.x+4,gB,PIPE_W-8,12);ctx.save();ctx.strokeStyle="rgba(36,91,74,0.55)";ctx.lineCap="round";for(let i=0;i<5;i++){const dx=p.x+8+((p.x*13+i*19)%Math.max(PIPE_W-16,1));ctx.lineWidth=0.8+(i%3)*0.35;ctx.beginPath();ctx.moveTo(dx,gT-capH+capH-1);ctx.lineTo(dx+Math.sin(tick*0.02+i)*1.5,gT-capH+capH+8+(i%4)*3);ctx.stroke();}ctx.restore();}

  /* ── Bird (skin-aware) ─────────────────────────── */
  function drawBird(){
    const sk=SKINS[selectedSkin];
    ctx.save();ctx.translate(BIRD_X,bird.y);ctx.rotate(bird.tilt);ctx.scale(1.08,1.02);
    const bw=BIRD_R*1.22,bh=BIRD_R*0.9,wingBeat=-Math.sin(bird.wing)*8;
    ctx.save();ctx.globalAlpha=0.18;ctx.filter="blur(1px)";ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(1,BIRD_R+7,BIRD_R*0.95,4.5,0.05,0,Math.PI*2);ctx.fill();ctx.restore();
    for(let i=-2;i<=2;i++){ctx.save();ctx.rotate(i*0.095);const tg=ctx.createLinearGradient(-bw-17,0,-bw+1,0);tg.addColorStop(0,sk.tail[0]);tg.addColorStop(0.65,sk.tail[1]);tg.addColorStop(1,sk.tail[2]);ctx.fillStyle=tg;ctx.beginPath();ctx.ellipse(-bw-7,i*2.1,13,3.4,-0.11,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(236,205,154,0.16)";ctx.lineWidth=0.5;ctx.stroke();ctx.restore();}
    const bg=ctx.createRadialGradient(-5,-8,2,-1,0,BIRD_R*1.35);bg.addColorStop(0,sk.body[0]);bg.addColorStop(0.28,sk.body[1]);bg.addColorStop(0.52,sk.body[2]);bg.addColorStop(0.76,sk.body[3]);bg.addColorStop(1,sk.body[5]);ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(-3,1,bw,bh,-0.04,0,Math.PI*2);ctx.fill();ctx.strokeStyle=sk.outline;ctx.lineWidth=0.9;ctx.stroke();
    if(shieldActive){ctx.save();ctx.globalAlpha=0.16+0.08*Math.sin(tick*0.1);ctx.strokeStyle="#e8c276";ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(0,0,BIRD_R*1.7,0,Math.PI*2);ctx.stroke();ctx.restore();}
    ctx.save();ctx.globalAlpha=0.38;ctx.strokeStyle=sk.feather;ctx.lineWidth=0.55;for(let row=0;row<5;row++){for(let col=0;col<7;col++){const fx=-14+col*4.5+(row%2)*1.6,fy=-8+row*4.3+Math.sin(col+row)*0.8;ctx.beginPath();ctx.moveTo(fx,fy);ctx.quadraticCurveTo(fx+5,fy+1.5,fx+8,fy+5.5);ctx.stroke();}}ctx.restore();
    ctx.save();ctx.globalAlpha=0.5;const ch=ctx.createRadialGradient(3,6,1,3,6,bh*0.76);ch.addColorStop(0,sk.chest);ch.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=ch;ctx.beginPath();ctx.ellipse(3,6,bw*0.48,bh*0.58,0,0,Math.PI*2);ctx.fill();ctx.restore();
    const hg=ctx.createRadialGradient(8,-12,1,9,-8,BIRD_R*0.92);hg.addColorStop(0,sk.body[0]);hg.addColorStop(0.5,sk.body[2]);hg.addColorStop(1,sk.body[4]);ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(9,-7,BIRD_R*0.82,BIRD_R*0.68,0.05,0,Math.PI*2);ctx.fill();ctx.strokeStyle=sk.outline;ctx.lineWidth=0.65;ctx.stroke();
    ctx.save();ctx.translate(-4,2);const wg=ctx.createLinearGradient(-15,wingBeat-6,8,12);wg.addColorStop(0,sk.wingHi);wg.addColorStop(0.28,sk.wing[0]);wg.addColorStop(0.62,sk.wing[1]);wg.addColorStop(1,sk.wing[2]);ctx.fillStyle=wg;ctx.beginPath();ctx.moveTo(6,-3);ctx.quadraticCurveTo(-6,wingBeat*0.45-5,-18,wingBeat+1);ctx.quadraticCurveTo(-16,8,-3,14);ctx.quadraticCurveTo(9,11,8,1);ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(28,18,12,0.32)";ctx.lineWidth=0.7;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(-13+i*2.7,wingBeat*0.2+i*1.4);ctx.quadraticCurveTo(-10+i*2.2,5+i*0.6,-3+i*1.7,13);ctx.stroke();}ctx.restore();
    const eyeH=3.8*(bird.vy>4?0.82:1);ctx.fillStyle="#efe7d7";ctx.beginPath();ctx.ellipse(13,-8,3.9,eyeH,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=sk.iris;ctx.beginPath();ctx.arc(13.8,-8+clamp(bird.vy*0.18,-0.8,0.8),2.3,0,Math.PI*2);ctx.fill();ctx.fillStyle="#080604";ctx.beginPath();ctx.arc(14.2,-8+clamp(bird.vy*0.18,-0.8,0.8),1.25,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(15,-9.2,0.75,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=sk.beakUp;ctx.beginPath();ctx.moveTo(19,-7);ctx.quadraticCurveTo(31,-8,36,-3.8);ctx.quadraticCurveTo(28,-2.6,19,-3.5);ctx.closePath();ctx.fill();ctx.fillStyle=sk.beakLo;ctx.beginPath();ctx.moveTo(19,-3);ctx.quadraticCurveTo(28,-2.2,34,-3.4);ctx.quadraticCurveTo(28,1.3,19,0.8);ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(35,20,13,0.46)";ctx.lineWidth=0.55;ctx.beginPath();ctx.moveTo(21,-3.3);ctx.quadraticCurveTo(28,-3.1,34,-3.5);ctx.stroke();
    ctx.restore();
  }

  function drawParticles(){for(const p of particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life);if(p.type==="feather"){ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.35,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.12)";ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(-p.size,0);ctx.lineTo(p.size,0);ctx.stroke();}else if(p.type==="sparkle"){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();}else{if(p.big){const sc=1+(1-p.life)*0.5;ctx.save();ctx.translate(p.x,p.y);ctx.scale(sc,sc);ctx.font="bold 36px system-ui";ctx.textAlign="center";ctx.strokeStyle="rgba(0,0,0,0.4)";ctx.lineWidth=5;ctx.strokeText(p.text,0,0);ctx.fillStyle="#fbbf24";ctx.fillText(p.text,0,0);ctx.restore();}else{ctx.font="bold 20px system-ui";ctx.textAlign="center";ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=3;ctx.strokeText(p.text,p.x,p.y);ctx.fillStyle="#fff";ctx.fillText(p.text,p.x,p.y);}}ctx.restore();}}

  function drawMedal(cx,cy){if(score<5)return;let mc,rc;if(score>=40){mc="#67e8f9";rc="#22d3ee";}else if(score>=25){mc="#fbbf24";rc="#f59e0b";}else if(score>=15){mc="#d1d5db";rc="#9ca3af";}else{mc="#d97706";rc="#b45309";}const r=24;ctx.fillStyle="rgba(0,0,0,0.2)";ctx.beginPath();ctx.arc(cx+2,cy+2,r+2,0,Math.PI*2);ctx.fill();ctx.fillStyle=rc;ctx.beginPath();ctx.arc(cx,cy,r+2,0,Math.PI*2);ctx.fill();const mg=ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,r);mg.addColorStop(0,"#fff");mg.addColorStop(0.3,mc);mg.addColorStop(1,rc);ctx.fillStyle=mg;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.6)";ctx.font="bold 22px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("★",cx,cy+1);}

  function drawScore(){if(state!=="running")return;ctx.save();const s=1+scorePulse*0.08;ctx.translate(refW/2,54);ctx.scale(s,s);ctx.shadowColor="rgba(0,0,0,0.34)";ctx.shadowBlur=12;ctx.shadowOffsetY=5;roundRect(-48,-22,96,44,13);const pg=ctx.createLinearGradient(-48,-22,48,22);pg.addColorStop(0,"rgba(44,31,21,0.82)");pg.addColorStop(0.35,"rgba(129,91,48,0.78)");pg.addColorStop(0.68,"rgba(74,54,34,0.86)");pg.addColorStop(1,"rgba(22,17,12,0.9)");ctx.fillStyle=pg;ctx.fill();ctx.strokeStyle="rgba(241,211,154,0.28)";ctx.lineWidth=1;ctx.stroke();ctx.save();ctx.globalCompositeOperation="screen";ctx.globalAlpha=0.13;ctx.fillStyle=TEX.metal;ctx.fillRect(-44,-18,88,36);ctx.restore();ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="900 28px Georgia,serif";ctx.fillStyle=scorePulse>0.1?"#f2d58e":"#e8d0a4";ctx.fillText(String(score).padStart(2,"0"),0,3);ctx.restore();}

  function drawOverlay(){
    if(state==="idle"&&!menuVisible){
      ctx.save();ctx.globalAlpha=0.2;for(const dp of demoPipes)drawPipe(dp);ctx.restore();
      ctx.save();ctx.fillStyle="rgba(15,23,42,0.3)";ctx.fillRect(0,0,refW,PLAY_H);ctx.textAlign="center";
      const titleY=PLAY_H/2-32+Math.sin(tick*0.03)*5;ctx.fillStyle="rgba(0,0,0,0.3)";ctx.font="bold 48px system-ui";ctx.fillText("Field Flight",refW/2+2,titleY+2);ctx.fillStyle="#ead7a5";ctx.fillText("Field Flight",refW/2,titleY);
      ctx.globalAlpha=0.6+0.4*Math.sin(tick*0.05);ctx.fillStyle="#e2e8f0";ctx.font="18px system-ui";ctx.fillText("Tap or Press Space",refW/2,PLAY_H/2+20);ctx.restore();
    }
    if(state==="idle"&&menuVisible){
      ctx.save();ctx.globalAlpha=0.15;for(const dp of demoPipes)drawPipe(dp);ctx.restore();
    }
    if(state==="over"){
      ctx.save();ctx.fillStyle=`rgba(15,23,42,${fadeAlpha})`;ctx.fillRect(0,0,refW,PLAY_H);
      if(fadeAlpha>0.3){const a=Math.min(1,(fadeAlpha-0.3)/0.35);ctx.globalAlpha=a;ctx.textAlign="center";
        ctx.font="bold 48px system-ui";ctx.fillStyle="#fef08a";ctx.fillText("Game Over",refW/2,PLAY_H/2-70);
        drawMedal(refW/2,PLAY_H/2-18);ctx.globalAlpha=a;
        ctx.font="bold 30px system-ui";ctx.fillStyle="#fff";ctx.fillText("Score: "+score,refW/2,PLAY_H/2+30);
        if(score===bestScore&&score>0){ctx.fillStyle="#fbbf24";ctx.font="bold 16px system-ui";ctx.fillText("★ New Best! ★",refW/2,PLAY_H/2+55);}
        ctx.font="22px system-ui";ctx.fillStyle="#94a3b8";ctx.fillText("Best: "+bestScore,refW/2,PLAY_H/2+78);
        const secs=gameStartTick>0?Math.floor((tick-gameStartTick)/60):0;
        ctx.font="14px system-ui";ctx.fillStyle="#64748b";
        ctx.fillText("Time: "+secs+"s  ·  Best Streak: "+maxStreak,refW/2,PLAY_H/2+100);}ctx.restore();}
  }

  function drawFlash(){if(flashAlpha<=0)return;ctx.fillStyle=`rgba(255,255,255,${flashAlpha})`;ctx.fillRect(0,0,refW,REF_H);}
  function drawVignette(){const cx=refW/2,cy=REF_H/2,r=Math.max(refW,REF_H)*0.58;const g=ctx.createRadialGradient(cx,cy,r*0.38,cx,cy,r);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(0.7,"rgba(0,0,0,0.06)");g.addColorStop(1,"rgba(0,0,0,0.28)");ctx.fillStyle=g;ctx.fillRect(0,0,refW,REF_H);}
  function drawFilmGrain(){ctx.save();ctx.globalCompositeOperation="overlay";ctx.globalAlpha=0.075;ctx.fillStyle=TEX.grain;ctx.fillRect(0,0,refW,REF_H);ctx.restore();}

  function drawCoins(){
    for(const c of coins){if(c.collected)continue;ctx.save();ctx.translate(c.x,c.y);
      ctx.globalAlpha=0.16;ctx.fillStyle="#e8c276";ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;const sw=Math.abs(Math.cos(tick*0.06+c.x*0.1))*5+3;
      const cg=ctx.createRadialGradient(-2,-2,1,0,0,9);cg.addColorStop(0,"#f1d99c");cg.addColorStop(0.45,"#a7773d");cg.addColorStop(1,"#3c2a1c");
      ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(0,0,sw,8,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="rgba(31,22,15,0.45)";ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,sw*0.72,5.5,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle="rgba(255,238,190,0.5)";ctx.font="bold 8px Georgia,serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("+",0,0.5);
      ctx.restore();}
  }
  function drawTrails(){
    for(const t of trails){ctx.save();ctx.globalAlpha=t.life*0.35;ctx.fillStyle=t.color;
      ctx.beginPath();ctx.arc(t.x,t.y,t.size*t.life,0,Math.PI*2);ctx.fill();ctx.restore();}
  }
  function drawSpeedLines(){
    if(state!=="running")return;const spd=speed();if(spd<2.5)return;
    const intensity=clamp((spd-2.5)/2,0,0.5);ctx.save();ctx.globalAlpha=intensity*0.12;
    ctx.strokeStyle="#fff";ctx.lineWidth=0.8;
    for(let i=0;i<6;i++){const y=(tick*3+i*97)%PLAY_H,x=(tick*2+i*151)%refW,len=rand(30,70)*(spd/2);
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-len,y);ctx.stroke();}ctx.restore();
  }
  function drawPause(){
    if(!paused)return;ctx.save();ctx.fillStyle="rgba(15,23,42,0.55)";ctx.fillRect(0,0,refW,PLAY_H);
    ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="bold 48px system-ui";
    ctx.fillText("PAUSED",refW/2,PLAY_H/2-10);ctx.fillStyle="#94a3b8";ctx.font="18px system-ui";
    ctx.fillText("Press P to resume",refW/2,PLAY_H/2+30);ctx.restore();
  }
  function drawStreak(){
    if(state!=="running"||streak<2)return;ctx.save();ctx.globalAlpha=0.7;
    ctx.textAlign="right";ctx.font="bold 16px system-ui";ctx.fillStyle="#fbbf24";
    ctx.fillText("Streak: "+streak,refW-20,30);ctx.restore();
  }

  function drawPowerups(){for(const pu of powerups){if(pu.collected)continue;ctx.save();ctx.translate(pu.x,pu.y);const pulse=0.8+0.2*Math.sin(tick*0.08),isSh=pu.type==="shield";ctx.globalAlpha=0.3*pulse;ctx.fillStyle=isSh?"#fbbf24":"#60a5fa";ctx.beginPath();ctx.arc(0,0,14*pulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.9;const og=ctx.createRadialGradient(-2,-2,1,0,0,9);og.addColorStop(0,isSh?"#fef9c3":"#bfdbfe");og.addColorStop(0.5,isSh?"#fbbf24":"#3b82f6");og.addColorStop(1,isSh?"#d97706":"#1d4ed8");ctx.fillStyle=og;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.8)";ctx.font="bold 10px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(isSh?"S":"T",0,0.5);ctx.restore();}}

  function draw(){ctx.clearRect(0,0,W,H);ctx.save();ctx.scale(S,S);ctx.translate(shakeX,shakeY);drawSky();drawSun();drawHaze();drawDayNight();drawClouds();drawMotes();drawHills();for(const p of pipes)drawPipe(p);drawCoins();drawPowerups();drawGround();drawTrails();drawBird();drawSpeedLines();drawParticles();drawScore();drawStreak();drawOverlay();drawFlash();if(slowmoTimer>0){ctx.save();ctx.fillStyle="rgba(59,130,246,0.06)";ctx.fillRect(0,0,refW,PLAY_H);ctx.restore();}drawPause();drawVignette();drawFilmGrain();ctx.restore();}
  function loop(){update();draw();requestAnimationFrame(loop);}

  /* ═══ Input ════════════════════════════════════ */
  window.addEventListener("keydown",e=>{
    if(e.code==="KeyP"&&state==="running"){paused=!paused;if(paused)stopMusic();else startMusic();return;}
    if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();if(!menuVisible){if(paused){paused=false;startMusic();}else flap();}}
  });
  canvas.addEventListener("pointerdown",e=>{if(!menuVisible){e.preventDefault();flap();}});

  /* ═══ Menu handlers ════════════════════════════ */
  document.getElementById("btn-play").addEventListener("click",()=>{init();showScreen(null);});
  document.getElementById("btn-birds").addEventListener("click",()=>{populateBirdGrid();showScreen("bird-screen");});
  document.getElementById("btn-settings").addEventListener("click",()=>{syncSettingsUI();showScreen("settings-screen");});
  document.getElementById("btn-birds-back").addEventListener("click",()=>showScreen("menu-screen"));
  document.getElementById("btn-settings-back").addEventListener("click",()=>showScreen("menu-screen"));
  document.getElementById("restart").addEventListener("click",()=>{init();showScreen(null);});
  document.getElementById("btn-to-menu").addEventListener("click",()=>{init();showScreen("menu-screen");});

  document.getElementById("set-sound").addEventListener("change",e=>{sfxOn=e.target.checked;savePrefs();});
  document.getElementById("set-music").addEventListener("change",e=>{musicOn=e.target.checked;if(!musicOn)stopMusic();savePrefs();});
  document.querySelectorAll(".diff-btn").forEach(btn=>{btn.addEventListener("click",()=>{document.querySelectorAll(".diff-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");difficulty=btn.dataset.diff;savePrefs();});});

  if(muteBtn){muteBtn.addEventListener("click",e=>{e.stopPropagation();muted=!muted;muteBtn.textContent=muted?"🔇":"🔊";if(muted)stopMusic();else if(musicOn&&state==="running")startMusic();});}

  /* ═══ Boot ═════════════════════════════════════ */
  loadPrefs();
  resize();
  window.addEventListener("resize",resize);
  initClouds(); initMotes(); initStars();
  init();
  showScreen("menu-screen");
  requestAnimationFrame(loop);
})();
