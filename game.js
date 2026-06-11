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
    classic:  { name:"Classic",  body:["#fefce8","#fef9c3","#facc15","#eab308","#ca8a04","#a16207"], outline:"rgba(120,53,15,0.3)", feather:"rgba(161,98,7,0.13)", chest:"#fefce8", wing:["#eab308","#d97706","#b45309"], wingHi:"#fef08a", tail:["#b45309","#92400e","#d97706"], tailHi:"rgba(251,191,36,0.3)", iris:"#92400e", beakUp:"#ea580c", beakLo:"#dc2626" },
    cardinal: { name:"Cardinal", body:["#fef2f2","#fecaca","#ef4444","#dc2626","#b91c1c","#991b1b"], outline:"rgba(127,29,29,0.3)", feather:"rgba(153,27,27,0.13)", chest:"#fef2f2", wing:["#dc2626","#b91c1c","#7f1d1d"], wingHi:"#fecaca", tail:["#7f1d1d","#991b1b","#b91c1c"], tailHi:"rgba(239,68,68,0.3)", iris:"#1c1917", beakUp:"#f97316", beakLo:"#ea580c" },
    bluebird: { name:"Bluebird", body:["#eff6ff","#bfdbfe","#3b82f6","#2563eb","#1d4ed8","#1e3a8a"], outline:"rgba(30,58,138,0.3)", feather:"rgba(30,64,175,0.13)", chest:"#eff6ff", wing:["#2563eb","#1d4ed8","#1e40af"], wingHi:"#bfdbfe", tail:["#1e40af","#1e3a8a","#1d4ed8"], tailHi:"rgba(59,130,246,0.3)", iris:"#1c1917", beakUp:"#f97316", beakLo:"#ea580c" },
    parrot:   { name:"Parrot",   body:["#f0fdf4","#bbf7d0","#22c55e","#16a34a","#15803d","#14532d"], outline:"rgba(20,83,45,0.3)", feather:"rgba(21,128,61,0.13)", chest:"#f0fdf4", wing:["#16a34a","#15803d","#166534"], wingHi:"#bbf7d0", tail:["#166534","#14532d","#15803d"], tailHi:"rgba(34,197,94,0.3)", iris:"#1c1917", beakUp:"#f97316", beakLo:"#ea580c" },
    phoenix:  { name:"Phoenix",  body:["#fff7ed","#fed7aa","#f97316","#ea580c","#c2410c","#9a3412"], outline:"rgba(154,52,18,0.3)", feather:"rgba(194,65,12,0.13)", chest:"#fff7ed", wing:["#ea580c","#c2410c","#9a3412"], wingHi:"#fed7aa", tail:["#9a3412","#7c2d12","#c2410c"], tailHi:"rgba(249,115,22,0.3)", iris:"#1c1917", beakUp:"#dc2626", beakLo:"#b91c1c" },
    frost:    { name:"Frost",    body:["#eef2ff","#e0e7ff","#a5b4fc","#818cf8","#6366f1","#4338ca"], outline:"rgba(67,56,202,0.3)", feather:"rgba(99,102,241,0.13)", chest:"#eef2ff", wing:["#818cf8","#6366f1","#4f46e5"], wingHi:"#e0e7ff", tail:["#4f46e5","#4338ca","#6366f1"], tailHi:"rgba(165,180,252,0.3)", iris:"#312e81", beakUp:"#f472b6", beakLo:"#ec4899" },
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
  function initClouds() { clouds = []; const w = refW||700; for (let i=0;i<12;i++) clouds.push({x:rand(-80,w+200),y:rand(20,PLAY_H*0.42),w:rand(65,170),h:rand(24,55),speed:rand(0.08,0.38),alpha:rand(0.18,0.5)}); }
  function initMotes() { motes = []; const w = refW||700; for (let i=0;i<45;i++) motes.push({x:rand(0,w),y:rand(15,PLAY_H*0.88),size:rand(0.5,2.2),sx:rand(0.04,0.2),sy:rand(-0.08,0.08),phase:rand(0,Math.PI*2),alpha:rand(0.1,0.32)}); }
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
  function drawSky(){const g=ctx.createLinearGradient(0,0,0,PLAY_H);g.addColorStop(0,"#075985");g.addColorStop(0.12,"#0369a1");g.addColorStop(0.28,"#0284c7");g.addColorStop(0.45,"#0ea5e9");g.addColorStop(0.6,"#38bdf8");g.addColorStop(0.74,"#7dd3fc");g.addColorStop(0.86,"#bae6fd");g.addColorStop(0.94,"#e0f2fe");g.addColorStop(1,"#f0f9ff");ctx.fillStyle=g;ctx.fillRect(0,0,refW,PLAY_H);}
  function drawHaze(){const hz=ctx.createLinearGradient(0,PLAY_H*0.6,0,PLAY_H);hz.addColorStop(0,"rgba(254,243,199,0)");hz.addColorStop(0.5,"rgba(254,243,199,0.08)");hz.addColorStop(1,"rgba(254,243,199,0.2)");ctx.fillStyle=hz;ctx.fillRect(0,PLAY_H*0.6,refW,PLAY_H*0.4);}
  function drawSun(){const sx=refW-80,sy=75;const g1=ctx.createRadialGradient(sx,sy,5,sx,sy,160);g1.addColorStop(0,"rgba(253,224,71,0.65)");g1.addColorStop(0.1,"rgba(253,224,71,0.25)");g1.addColorStop(0.3,"rgba(253,186,116,0.08)");g1.addColorStop(0.6,"rgba(253,186,116,0.02)");g1.addColorStop(1,"rgba(253,186,116,0)");ctx.fillStyle=g1;ctx.fillRect(0,0,refW,PLAY_H);const g2=ctx.createRadialGradient(sx,sy,14,sx,sy,50);g2.addColorStop(0,"rgba(255,255,240,0.45)");g2.addColorStop(0.5,"rgba(253,224,71,0.1)");g2.addColorStop(1,"rgba(253,224,71,0)");ctx.fillStyle=g2;ctx.beginPath();ctx.arc(sx,sy,50,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(sx,sy);ctx.rotate(tick*0.0007);ctx.globalAlpha=0.035;ctx.fillStyle="#fef08a";for(let i=0;i<14;i++){ctx.save();ctx.rotate((i/14)*Math.PI*2);ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(0,-140);ctx.lineTo(5,0);ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();const dg=ctx.createRadialGradient(sx-3,sy-3,2,sx,sy,22);dg.addColorStop(0,"#fffef5");dg.addColorStop(0.4,"#fef9c3");dg.addColorStop(0.8,"#fde047");dg.addColorStop(1,"#facc15");ctx.fillStyle=dg;ctx.beginPath();ctx.arc(sx,sy,22,0,Math.PI*2);ctx.fill();}

  function drawDayNight(){if(state!=="running"&&state!=="dying")return;const p=dayPhase();if(p>0.15&&p<0.45){ctx.fillStyle=`rgba(234,88,12,${Math.sin(((p-0.15)/0.3)*Math.PI)*0.22})`;ctx.fillRect(0,0,refW,PLAY_H);}if(p>0.35&&p<0.75){const t=(p-0.35)/0.4,ni=Math.sin(t*Math.PI);ctx.fillStyle=`rgba(15,10,40,${ni*0.55})`;ctx.fillRect(0,0,refW,PLAY_H);if(ni>0.25){ctx.save();for(const s of stars){ctx.globalAlpha=ni*(0.4+0.6*Math.sin(tick*0.04+s.tw))*0.7;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s.x*refW,s.y*PLAY_H,s.size,0,Math.PI*2);ctx.fill();}ctx.restore();}if(ni>0.4){const mx=refW*0.2,my=85;ctx.save();ctx.globalAlpha=ni;const mg=ctx.createRadialGradient(mx,my,8,mx,my,55);mg.addColorStop(0,"rgba(226,232,240,0.25)");mg.addColorStop(1,"rgba(226,232,240,0)");ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,55,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e2e8f0";ctx.beginPath();ctx.arc(mx,my,18,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(148,163,184,0.3)";ctx.beginPath();ctx.arc(mx-5,my-4,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(mx+6,my+3,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(mx-2,my+7,2.5,0,Math.PI*2);ctx.fill();ctx.restore();}}if(p>0.65&&p<0.9){ctx.fillStyle=`rgba(219,39,119,${Math.sin(((p-0.65)/0.25)*Math.PI)*0.1})`;ctx.fillRect(0,0,refW,PLAY_H);}}

  function drawCloudShape(x,y,w,h){ctx.beginPath();const r=h*0.5;ctx.arc(x+w*0.12,y+r*0.15,r*0.8,0,Math.PI*2);ctx.arc(x+w*0.28,y-r*0.1,r*1.1,0,Math.PI*2);ctx.arc(x+w*0.46,y-r*0.5,r*1.35,0,Math.PI*2);ctx.arc(x+w*0.64,y-r*0.15,r*1.15,0,Math.PI*2);ctx.arc(x+w*0.8,y+r*0.1,r*0.9,0,Math.PI*2);ctx.arc(x+w*0.36,y+r*0.3,r,0,Math.PI*2);ctx.arc(x+w*0.58,y+r*0.25,r*1.05,0,Math.PI*2);ctx.fill();}
  function drawClouds(){for(const c of clouds){ctx.save();ctx.globalAlpha=c.alpha;ctx.fillStyle="rgba(100,116,139,0.14)";drawCloudShape(c.x+3,c.y+5,c.w,c.h);const cg=ctx.createLinearGradient(c.x,c.y-c.h*0.6,c.x,c.y+c.h*0.5);cg.addColorStop(0,"#fffefb");cg.addColorStop(0.4,"#fff");cg.addColorStop(0.75,"#e8ecf0");cg.addColorStop(1,"#cbd5e1");ctx.fillStyle=cg;drawCloudShape(c.x,c.y,c.w,c.h);ctx.globalAlpha=c.alpha*0.3;ctx.fillStyle="rgba(254,249,195,0.5)";drawCloudShape(c.x+1,c.y-2,c.w*0.85,c.h*0.6);ctx.restore();}}
  function drawMotes(){for(const m of motes){const pulse=0.5+0.5*Math.sin(tick*0.025+m.phase);ctx.save();ctx.globalAlpha=m.alpha*(0.6+0.4*pulse);ctx.fillStyle="#fef9c3";ctx.beginPath();ctx.arc(m.x,m.y,m.size,0,Math.PI*2);ctx.fill();ctx.restore();}}

  function drawHills(){const fg=ctx.createLinearGradient(0,PLAY_H-55,0,PLAY_H);fg.addColorStop(0,"#6ee7a0");fg.addColorStop(1,"#86efac");ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(0,PLAY_H);for(let x=0;x<=refW;x+=2){const sx=x+farOff;ctx.lineTo(x,PLAY_H-42+Math.sin(sx*0.011+1.2)*22+Math.sin(sx*0.019)*10-Math.abs(Math.sin(sx*0.14))*6);}ctx.lineTo(refW,PLAY_H);ctx.fill();const ng=ctx.createLinearGradient(0,PLAY_H-30,0,PLAY_H);ng.addColorStop(0,"#4ade80");ng.addColorStop(1,"#22c55e");ctx.fillStyle=ng;ctx.beginPath();ctx.moveTo(0,PLAY_H);for(let x=0;x<=refW;x+=2){const sx=x+nearOff;ctx.lineTo(x,PLAY_H-20+Math.sin(sx*0.014+0.5)*14+Math.sin(sx*0.026)*7-Math.abs(Math.sin(sx*0.19))*5);}ctx.lineTo(refW,PLAY_H);ctx.fill();}

  function drawGround(){const y=PLAY_H;const dg=ctx.createLinearGradient(0,y,0,REF_H);dg.addColorStop(0,"#a16207");dg.addColorStop(0.06,"#92400e");dg.addColorStop(0.2,"#854d0e");dg.addColorStop(0.45,"#78350f");dg.addColorStop(0.7,"#713f12");dg.addColorStop(1,"#451a03");ctx.fillStyle=dg;ctx.fillRect(0,y,refW,GROUND_H);ctx.strokeStyle="rgba(120,53,15,0.18)";ctx.lineWidth=1;for(let sy=y+20;sy<REF_H-8;sy+=14){ctx.beginPath();ctx.moveTo(0,sy);for(let sx=0;sx<=refW;sx+=20)ctx.lineTo(sx,sy+Math.sin(sx*0.08+sy)*1.5);ctx.stroke();}for(let i=0;i<18;i++){const rx=(i*47+11)%~~refW,ry=y+18+(i*23)%(GROUND_H-26),rs=1.2+(i*13)%3;const rg=ctx.createRadialGradient(rx-0.5,ry-0.5,0,rx,ry,rs*1.4);rg.addColorStop(0,"rgba(168,130,100,0.45)");rg.addColorStop(1,"rgba(120,80,50,0.25)");ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(rx,ry,rs*1.4,rs,i*0.5,0,Math.PI*2);ctx.fill();}const gg=ctx.createLinearGradient(0,y-6,0,y+14);gg.addColorStop(0,"#22c55e");gg.addColorStop(0.3,"#16a34a");gg.addColorStop(0.7,"#15803d");gg.addColorStop(1,"#166534");ctx.fillStyle=gg;ctx.fillRect(0,y-2,refW,16);const gp=["#22c55e","#16a34a","#15803d","#166534"];for(let ci=0;ci<4;ci++){ctx.strokeStyle=gp[ci];ctx.lineWidth=1.1;ctx.beginPath();for(let gx=-groundOff+ci*2.5;gx<refW+20;gx+=10){const h=7+Math.sin(gx*0.7)*3+Math.cos(gx*1.3)*2,bend=Math.sin(gx*0.25+tick*0.012)*2.5;ctx.moveTo(gx,y-1);ctx.quadraticCurveTo(gx+bend*0.4,y-h*0.6,gx+bend,y-h);}ctx.stroke();}}

  function drawPipeBody(x,y,w,h){if(h<=0)return;const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,"#14532d");g.addColorStop(0.04,"#166534");g.addColorStop(0.14,"#22c55e");g.addColorStop(0.28,"#4ade80");g.addColorStop(0.36,"#86efac");g.addColorStop(0.42,"#4ade80");g.addColorStop(0.6,"#22c55e");g.addColorStop(0.78,"#166534");g.addColorStop(0.92,"#14532d");g.addColorStop(1,"#052e16");ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.fillStyle="rgba(255,255,255,0.13)";ctx.fillRect(x+w*0.32,y,2,h);ctx.fillStyle="rgba(255,255,255,0.05)";ctx.fillRect(x+w*0.14,y,w*0.05,h);ctx.fillStyle="rgba(0,0,0,0.18)";ctx.fillRect(x+w-2,y,2,h);ctx.fillStyle="rgba(0,0,0,0.08)";ctx.fillRect(x,y,2,h);ctx.globalAlpha=0.03;ctx.strokeStyle="#000";ctx.lineWidth=1;for(let si=0;si<3;si++){const sx=x+w*0.2+si*w*0.22;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+1,y+h);ctx.stroke();}ctx.globalAlpha=1;}
  function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();}
  function drawPipeCap(x,y,w,h){const r=5;ctx.fillStyle="rgba(0,0,0,0.16)";roundRect(x+2,y+3,w,h,r);const g=ctx.createLinearGradient(x,0,x+w,0);g.addColorStop(0,"#14532d");g.addColorStop(0.06,"#166534");g.addColorStop(0.15,"#22c55e");g.addColorStop(0.32,"#86efac");g.addColorStop(0.42,"#bbf7d0");g.addColorStop(0.5,"#86efac");g.addColorStop(0.65,"#4ade80");g.addColorStop(0.82,"#16a34a");g.addColorStop(0.94,"#14532d");g.addColorStop(1,"#052e16");ctx.fillStyle=g;roundRect(x,y,w,h,r);ctx.fillStyle="rgba(255,255,255,0.15)";ctx.fillRect(x+r,y+2,w-r*2,2);ctx.fillStyle="rgba(0,0,0,0.12)";ctx.fillRect(x+r,y+h-3,w-r*2,3);for(let rx=x+12;rx<x+w-8;rx+=13){ctx.fillStyle="rgba(60,60,60,0.25)";ctx.beginPath();ctx.arc(rx,y+h*0.5,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.12)";ctx.beginPath();ctx.arc(rx-0.6,y+h*0.5-0.6,1,0,Math.PI*2);ctx.fill();}}
  function drawPipe(p){const g=p.gap||D().pipeGap,gT=p.gapY-g/2,gB=p.gapY+g/2,capH=28,ovr=7;drawPipeBody(p.x,0,PIPE_W,gT-capH);drawPipeCap(p.x-ovr,gT-capH,PIPE_W+ovr*2,capH);drawPipeBody(p.x,gB+capH,PIPE_W,PLAY_H-gB-capH);drawPipeCap(p.x-ovr,gB,PIPE_W+ovr*2,capH);let ti=ctx.createLinearGradient(0,gT,0,gT-8);ti.addColorStop(0,"rgba(5,46,22,0.4)");ti.addColorStop(1,"rgba(5,46,22,0)");ctx.fillStyle=ti;ctx.fillRect(p.x+4,gT-8,PIPE_W-8,8);ti=ctx.createLinearGradient(0,gB,0,gB+8);ti.addColorStop(0,"rgba(5,46,22,0.4)");ti.addColorStop(1,"rgba(5,46,22,0)");ctx.fillStyle=ti;ctx.fillRect(p.x+4,gB,PIPE_W-8,8);}

  /* ── Bird (skin-aware) ─────────────────────────── */
  function drawBird(){
    const sk=SKINS[selectedSkin];
    ctx.save();ctx.translate(BIRD_X,bird.y);ctx.rotate(bird.tilt);
    const bw=BIRD_R*1.15,bh=BIRD_R*0.92;
    ctx.save();ctx.globalAlpha=0.13;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(2,BIRD_R+6,BIRD_R*0.7,3.5,0.05,0,Math.PI*2);ctx.fill();ctx.restore();
    for(let i=-2;i<=2;i++){ctx.save();ctx.rotate(i*0.1);const tg=ctx.createLinearGradient(-bw-12,0,-bw+2,0);tg.addColorStop(0,i===0?sk.tail[0]:sk.tail[1]);tg.addColorStop(1,sk.tail[2]);ctx.fillStyle=tg;ctx.beginPath();ctx.ellipse(-bw-4,i*2.5,10,3.2,-0.08,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.fillStyle=sk.tailHi;ctx.beginPath();ctx.ellipse(-bw-2,0,7,2,0,0,Math.PI*2);ctx.fill();
    const bg=ctx.createRadialGradient(3,-4,2,0,0,BIRD_R*1.1);bg.addColorStop(0,sk.body[0]);bg.addColorStop(0.2,sk.body[1]);bg.addColorStop(0.45,sk.body[2]);bg.addColorStop(0.7,sk.body[3]);bg.addColorStop(0.88,sk.body[4]);bg.addColorStop(1,sk.body[5]);ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(0,0,bw,bh,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=sk.outline;ctx.lineWidth=0.8;ctx.stroke();if(shieldActive){ctx.save();ctx.globalAlpha=0.2+0.1*Math.sin(tick*0.1);ctx.strokeStyle="#fbbf24";ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,BIRD_R*1.6,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=0.06;ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(0,0,BIRD_R*1.6,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.strokeStyle=sk.feather;ctx.lineWidth=0.6;[[-8,-2,7,-0.6,0.7],[-3,1,7,-0.5,0.8],[2,3,6,-0.4,0.6],[-6,5,5,-0.5,0.5],[1,-4,6,-0.3,0.7]].forEach(([fx,fy,fr,a1,a2])=>{ctx.beginPath();ctx.arc(fx,fy,fr,a1,a2);ctx.stroke();});
    ctx.save();ctx.globalAlpha=0.28;const ch=ctx.createRadialGradient(3,5,1,3,5,bh*0.6);ch.addColorStop(0,sk.chest);ch.addColorStop(1,"transparent");ctx.fillStyle=ch;ctx.beginPath();ctx.ellipse(3,5,bw*0.45,bh*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
    const wt=-Math.sin(bird.wing)*10;ctx.save();ctx.translate(-2,3);const wg=ctx.createLinearGradient(0,Math.min(0,wt)-4,0,10);wg.addColorStop(0,sk.wing[0]);wg.addColorStop(0.4,sk.wing[1]);wg.addColorStop(1,sk.wing[2]);ctx.fillStyle=wg;ctx.beginPath();ctx.moveTo(4,1);ctx.quadraticCurveTo(-2,wt*0.5,-14,wt);ctx.lineTo(-11,wt+3);ctx.lineTo(-16,wt+1);ctx.lineTo(-12,wt+6);ctx.lineTo(-17,wt+4);ctx.quadraticCurveTo(-8,9,4,6);ctx.closePath();ctx.fill();ctx.globalAlpha=0.2;ctx.fillStyle=sk.wingHi;ctx.beginPath();ctx.moveTo(2,1);ctx.quadraticCurveTo(-1,wt*0.4,-8,wt+2);ctx.quadraticCurveTo(-3,5,2,5);ctx.closePath();ctx.fill();ctx.restore();
    const eyeH=5.2*(bird.vy<-3?1.15:bird.vy>4?0.75:1);ctx.fillStyle="#fff";ctx.beginPath();ctx.ellipse(8,-4,5.8,eyeH,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.12)";ctx.lineWidth=0.5;ctx.stroke();
    const pupilOff=clamp(bird.vy*0.3,-1.5,1.5);ctx.fillStyle=sk.iris;ctx.beginPath();ctx.arc(9.2,-4+pupilOff,3.2,0,Math.PI*2);ctx.fill();ctx.fillStyle="#0f172a";ctx.beginPath();ctx.arc(9.8,-4+pupilOff,1.8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(10.8,-5.5,1.3,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.5)";ctx.beginPath();ctx.arc(8.2,-3,0.7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=sk.beakUp;ctx.beginPath();ctx.moveTo(bw-1,-2);ctx.quadraticCurveTo(bw+9,-3,bw+13,0.5);ctx.quadraticCurveTo(bw+9,1.5,bw-1,1.5);ctx.closePath();ctx.fill();
    ctx.fillStyle=sk.beakLo;ctx.beginPath();ctx.moveTo(bw-1,2);ctx.quadraticCurveTo(bw+7,2.5,bw+11,1);ctx.quadraticCurveTo(bw+7,5,bw-1,4.5);ctx.closePath();ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.18)";ctx.beginPath();ctx.moveTo(bw,-1);ctx.quadraticCurveTo(bw+6,-2,bw+10,0);ctx.quadraticCurveTo(bw+6,0.5,bw,0.5);ctx.closePath();ctx.fill();
    ctx.restore();
  }

  function drawParticles(){for(const p of particles){ctx.save();ctx.globalAlpha=Math.max(0,p.life);if(p.type==="feather"){ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.35,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.12)";ctx.lineWidth=0.4;ctx.beginPath();ctx.moveTo(-p.size,0);ctx.lineTo(p.size,0);ctx.stroke();}else if(p.type==="sparkle"){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();}else{if(p.big){const sc=1+(1-p.life)*0.5;ctx.save();ctx.translate(p.x,p.y);ctx.scale(sc,sc);ctx.font="bold 36px system-ui";ctx.textAlign="center";ctx.strokeStyle="rgba(0,0,0,0.4)";ctx.lineWidth=5;ctx.strokeText(p.text,0,0);ctx.fillStyle="#fbbf24";ctx.fillText(p.text,0,0);ctx.restore();}else{ctx.font="bold 20px system-ui";ctx.textAlign="center";ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=3;ctx.strokeText(p.text,p.x,p.y);ctx.fillStyle="#fff";ctx.fillText(p.text,p.x,p.y);}}ctx.restore();}}

  function drawMedal(cx,cy){if(score<5)return;let mc,rc;if(score>=40){mc="#67e8f9";rc="#22d3ee";}else if(score>=25){mc="#fbbf24";rc="#f59e0b";}else if(score>=15){mc="#d1d5db";rc="#9ca3af";}else{mc="#d97706";rc="#b45309";}const r=24;ctx.fillStyle="rgba(0,0,0,0.2)";ctx.beginPath();ctx.arc(cx+2,cy+2,r+2,0,Math.PI*2);ctx.fill();ctx.fillStyle=rc;ctx.beginPath();ctx.arc(cx,cy,r+2,0,Math.PI*2);ctx.fill();const mg=ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,r);mg.addColorStop(0,"#fff");mg.addColorStop(0.3,mc);mg.addColorStop(1,rc);ctx.fillStyle=mg;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.6)";ctx.font="bold 22px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("★",cx,cy+1);}

  function drawScore(){if(state!=="running")return;ctx.save();const s=1+scorePulse*0.22;ctx.translate(refW/2,68);ctx.scale(s,s);ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 58px system-ui,-apple-system,sans-serif";ctx.fillStyle="rgba(0,0,0,0.2)";ctx.fillText(score,2,2);ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=5;ctx.lineJoin="round";ctx.strokeText(score,0,0);ctx.fillStyle=scorePulse>0.1?"#fef08a":"#fff";ctx.fillText(score,0,0);ctx.restore();}

  function drawOverlay(){
    if(state==="idle"&&!menuVisible){
      ctx.save();ctx.globalAlpha=0.2;for(const dp of demoPipes)drawPipe(dp);ctx.restore();
      ctx.save();ctx.fillStyle="rgba(15,23,42,0.3)";ctx.fillRect(0,0,refW,PLAY_H);ctx.textAlign="center";
      const titleY=PLAY_H/2-32+Math.sin(tick*0.03)*5;ctx.fillStyle="rgba(0,0,0,0.3)";ctx.font="bold 48px system-ui";ctx.fillText("Flappy Bird",refW/2+2,titleY+2);ctx.fillStyle="#fef08a";ctx.fillText("Flappy Bird",refW/2,titleY);
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
  function drawVignette(){const cx=refW/2,cy=REF_H/2,r=Math.max(refW,REF_H)*0.55;const g=ctx.createRadialGradient(cx,cy,r*0.45,cx,cy,r);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(0.7,"rgba(0,0,0,0.04)");g.addColorStop(1,"rgba(0,0,0,0.2)");ctx.fillStyle=g;ctx.fillRect(0,0,refW,REF_H);}

  function drawCoins(){
    for(const c of coins){if(c.collected)continue;ctx.save();ctx.translate(c.x,c.y);
      ctx.globalAlpha=0.3;ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;const sw=Math.abs(Math.cos(tick*0.06+c.x*0.1))*7+2;
      const cg=ctx.createRadialGradient(-1,-1,1,0,0,8);cg.addColorStop(0,"#fef9c3");cg.addColorStop(0.5,"#fbbf24");cg.addColorStop(1,"#d97706");
      ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(0,0,sw,8,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="bold 9px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("★",0,0.5);
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

  function draw(){ctx.clearRect(0,0,W,H);ctx.save();ctx.scale(S,S);ctx.translate(shakeX,shakeY);drawSky();drawSun();drawHaze();drawDayNight();drawClouds();drawMotes();drawHills();for(const p of pipes)drawPipe(p);drawCoins();drawPowerups();drawGround();drawTrails();drawBird();drawSpeedLines();drawParticles();drawScore();drawStreak();drawOverlay();drawFlash();if(slowmoTimer>0){ctx.save();ctx.fillStyle="rgba(59,130,246,0.06)";ctx.fillRect(0,0,refW,PLAY_H);ctx.restore();}drawPause();drawVignette();ctx.restore();}
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
