// Minimal dependencies — plain JS. Adds animated particle background and device interactions.

(function(){
  // ---------- particle background ----------
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = innerWidth;
    h = canvas.height = innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function makeParticles(n = 160) {
    particles = [];
    for (let i=0;i<n;i++){
      particles.push({
        x: Math.random()*w,
        y: Math.random()*h,
        vx: (Math.random()-0.5)*0.3,
        vy: (Math.random()-0.5)*0.3,
        r: Math.random()*1.6 + 0.6,
        hue: 170 + Math.random()*40
      });
    }
  }
  makeParticles(220);

  function drawBG(t){
    ctx.clearRect(0,0,w,h);
    // subtle gradient
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, 'rgba(0,8,20,0.45)');
    g.addColorStop(1, 'rgba(2,6,10,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // particles
    for (const p of particles){
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = w+20;
      if (p.x > w+20) p.x = -20;
      if (p.y < -20) p.y = h+20;
      if (p.y > h+20) p.y = -20;

      const alpha = 0.6 + 0.4*Math.sin((t/1200)+(p.x+p.y)/600);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},90%,60%,${alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    requestAnimationFrame(drawBG);
  }
  requestAnimationFrame(drawBG);

  // ---------- API helpers ----------
  async function apiGet(path){
    try {
      const res = await fetch(path);
      return await res.json();
    } catch(e){ console.warn('api error', e); return null }
  }
  async function apiPost(path, body){
    try {
      const res = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{}) });
      return await res.json();
    } catch(e){ console.warn('api error', e); return null }
  }

  // ---------- UI render ----------
  const devicesGrid = document.getElementById('devicesGrid');
  const systemStatus = document.getElementById('systemStatus');
  const activeCount = document.getElementById('activeCount');
  const lastEvent = document.getElementById('lastEvent');
  const refreshBtn = document.getElementById('refreshBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  refreshBtn.addEventListener('click', loadAll);
  logoutBtn.addEventListener('click', ()=> location.href = '/home');

  let lastFetched = 0;
  async function loadAll(){
    const s = await apiGet('/api/status');
    if (s) {
      systemStatus.textContent = s.uptime ? `Online — ${Math.floor(s.uptime/1000)}s` : 'Online';
      lastEvent.textContent = s.lastEvent || '—';
    }
    const devs = await apiGet('/api/devices');
    if (devs && Array.isArray(devs)) {
      renderDevices(devs);
      activeCount.textContent = devs.filter(d=>d.on).length + ' / ' + devs.length;
      lastFetched = Date.now();
    }
  }

  function renderDevices(list){
    devicesGrid.innerHTML = '';
    for (const d of list){
      const card = document.createElement('div');
      card.className = 'device-card' + (d.on? ' pulse-on':'');
      card.innerHTML = `
        <div class="pulse"></div>
        <div class="dev-title">
          <span>${d.name}</span>
          <span class="dev-state">${d.type}</span>
        </div>
        <div class="desc">${d.desc || ''}</div>
        <div class="controls">
          <button class="btn toggleBtn ${d.on ? 'on':''}">${d.on? 'ON':'OFF'}</button>
          <input type="range" class="range" min="0" max="100" value="${d.brightness||0}">
        </div>
      `;
      // toggle
      const toggle = card.querySelector('.toggleBtn');
      const range = card.querySelector('.range');

      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        const res = await apiPost(`/api/devices/${encodeURIComponent(d.id)}/toggle`);
        if (res && res.ok) {
          toggle.classList.toggle('on', res.on);
          toggle.textContent = res.on ? 'ON' : 'OFF';
          card.classList.toggle('pulse-on', res.on);
        }
        toggle.disabled = false;
      });

      range.addEventListener('input', throttle(async (e) => {
        const val = e.target.value;
        const res = await apiPost(`/api/devices/${encodeURIComponent(d.id)}/brightness`, { value: Number(val) });
        if (res && res.ok) {
          // visual feedback
          card.animate([{ boxShadow: '0 0 0 rgba(0,0,0,0)' }, { boxShadow: `0 20px 40px rgba(0,255,213,0.06)` }], { duration: 300, direction: 'alternate' });
        }
      }, 220));

      devicesGrid.appendChild(card);
    }
  }

  function throttle(fn, wait){
    let last=0, t;
    return function(...args){
      const now = Date.now();
      if (now - last > wait) { last = now; fn.apply(this,args); }
      else { clearTimeout(t); t = setTimeout(()=>{ last = Date.now(); fn.apply(this,args); }, wait - (now-last)); }
    }
  }

  // start loop
  loadAll();
  setInterval(loadAll, 12000);
})();