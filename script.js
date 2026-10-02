const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const goldValue = document.getElementById('goldValue');
const livesValue = document.getElementById('livesValue');
const waveValue = document.getElementById('waveValue');
const startWaveBtn = document.getElementById('startWaveBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const buildButtons = [...document.querySelectorAll('.build-btn')];
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const finalWaveDisplay = document.getElementById('finalWave');

const board = {
  cols: 7,
  rows: 5,
  cell: 72,
  width: 504,
  height: 360,
};

const pathPoints = [
  { x: 0.5 * board.cell, y: 2.5 * board.cell },
  { x: 2.0 * board.cell, y: 2.5 * board.cell },
  { x: 2.0 * board.cell, y: 4.5 * board.cell },
  { x: 4.7 * board.cell, y: 4.5 * board.cell },
  { x: 4.7 * board.cell, y: 1.5 * board.cell },
  { x: 6.5 * board.cell, y: 1.5 * board.cell },
];

const pathCells = new Set();
for (let i = 0; i < pathPoints.length; i += 1) {
  const point = pathPoints[i];
  const cellX = Math.floor(point.x / board.cell);
  const cellY = Math.floor(point.y / board.cell);
  pathCells.add(`${cellX},${cellY}`);
}

function buildPathSegments() {
  const segments = [];
  for (let i = 0; i < pathPoints.length - 1; i += 1) {
    segments.push({
      a: pathPoints[i],
      b: pathPoints[i + 1],
    });
  }
  return segments;
}

const pathSegments = buildPathSegments();

const towerTypes = {
  pulse: {
    label: 'Pulse',
    cost: 70,
    range: 105,
    damage: 12,
    fireRate: 0.7,
    bulletSpeed: 260,
    color: '#8cc8ff',
    accent: '#2d7ec9',
  },
  bloom: {
    label: 'Bloom',
    cost: 95,
    range: 130,
    damage: 18,
    fireRate: 1.15,
    bulletSpeed: 240,
    color: '#ffd9ae',
    accent: '#df9f40',
  },
};

const state = {
  gold: 180,
  lives: 12,
  wave: 0,
  towers: [],
  enemies: [],
  projectiles: [],
  buildMode: 'pulse',
  selectedTowerId: null,
  waveActive: false,
  spawnQueue: [],
  spawnTimer: 0,
  lastTime: 0,
  gameOver: false,
  particles: [],
  gameStarted: false,
};

function updateHud() {
  goldValue.textContent = String(state.gold);
  livesValue.textContent = String(state.lives);
  waveValue.textContent = String(state.wave);

  buildButtons.forEach((button) => {
    button.classList.toggle('selected', button.dataset.type === state.buildMode);
  });

  const tower = getSelectedTower();
  const canUpgrade = !!tower && state.gold >= tower.upgradeCost && !state.gameOver;
  upgradeBtn.disabled = !canUpgrade;
  upgradeBtn.textContent = tower ? `Upgrade ($${tower.upgradeCost})` : 'Upgrade';

  startWaveBtn.disabled = state.waveActive || state.gameOver;
  startWaveBtn.textContent = state.waveActive ? 'Wave in progress' : 'Start Wave';
}

function getSelectedTower() {
  return state.towers.find((tower) => tower.id === state.selectedTowerId) || null;
}

function getPathLength() {
  return pathSegments.reduce((total, segment) => total + distance(segment.a, segment.b), 0);
}

const pathLength = getPathLength();

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getPointOnPath(distanceTravelled) {
  let remaining = distanceTravelled;
  for (const segment of pathSegments) {
    const segLength = distance(segment.a, segment.b);
    if (remaining <= segLength) {
      const t = segLength === 0 ? 0 : remaining / segLength;
      return {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      };
    }
    remaining -= segLength;
  }
  return { ...pathPoints[pathPoints.length - 1] };
}

function canPlaceTower(cellX, cellY) {
  if (cellX < 0 || cellX >= board.cols || cellY < 0 || cellY >= board.rows) {
    return false;
  }

  if (pathCells.has(`${cellX},${cellY}`)) {
    return false;
  }

  return !state.towers.some((tower) => {
    const towerCellX = Math.floor(tower.x / board.cell);
    const towerCellY = Math.floor(tower.y / board.cell);
    return towerCellX === cellX && towerCellY === cellY;
  });
}

function makeTower(type, x, y) {
  const stats = towerTypes[type];
  const tower = {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    level: 1,
    range: stats.range,
    damage: stats.damage,
    fireRate: stats.fireRate,
    fireCooldown: 0,
    color: stats.color,
    accent: stats.accent,
    upgradeCost: 35,
  };
  return tower;
}

function placeTowerAtCell(cellX, cellY) {
  if (!canPlaceTower(cellX, cellY)) {
    return false;
  }

  const type = state.buildMode;
  const cost = towerTypes[type].cost;
  if (state.gold < cost) {
    return false;
  }

  const x = cellX * board.cell + board.cell / 2;
  const y = cellY * board.cell + board.cell / 2;

  state.gold -= cost;
  const tower = makeTower(type, x, y);
  state.towers.push(tower);
  state.selectedTowerId = tower.id;
  playSound('place');
  updateHud();
  return true;
}

function upgradeSelectedTower() {
  const tower = getSelectedTower();
  if (!tower || state.gold < tower.upgradeCost || state.gameOver) {
    return;
  }

  state.gold -= tower.upgradeCost;
  tower.level += 1;
  tower.damage *= 1.45;
  tower.range *= 1.08;
  tower.fireRate *= 0.92;
  tower.upgradeCost = 35 + tower.level * 22;
  playSound('upgrade');
  createParticles(tower.x, tower.y, tower.color, 8);
  updateHud();
}

function getTowerByCell(x, y) {
  for (const tower of state.towers) {
    const towerX = Math.floor(tower.x / board.cell);
    const towerY = Math.floor(tower.y / board.cell);
    if (towerX === x && towerY === y) {
      return tower;
    }
  }
  return null;
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function handlePointer(event) {
  if (!state.gameStarted || state.gameOver) return;

  const point = getPointerPosition(event);
  const cellX = Math.floor(point.x / board.cell);
  const cellY = Math.floor(point.y / board.cell);

  const pickedTower = state.towers.find((tower) => {
    return Math.hypot(tower.x - point.x, tower.y - point.y) < 22;
  });

  if (pickedTower) {
    state.selectedTowerId = pickedTower.id;
    updateHud();
    return;
  }

  if (canPlaceTower(cellX, cellY)) {
    placeTowerAtCell(cellX, cellY);
    updateHud();
  }
}

canvas.addEventListener('pointerdown', handlePointer);

buildButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.buildMode = button.dataset.type;
    updateHud();
  });
});

startWaveBtn.addEventListener('click', () => {
  if (state.waveActive || state.gameOver || !state.gameStarted) {
    return;
  }

  state.wave += 1;
  const enemyCount = 5 + state.wave * 2;
  state.spawnQueue = Array.from({ length: enemyCount }, (_, index) => ({
    hp: 24 + state.wave * 11 + index * 3,
    speed: 34 + state.wave * 4,
    reward: 10 + state.wave * 3,
    color: index % 2 === 0 ? '#2a3a45' : '#6e7982',
  }));
  state.waveActive = true;
  state.spawnTimer = 0.45;
  playSound('wave');
  updateHud();
});

upgradeBtn.addEventListener('click', () => {
  upgradeSelectedTower();
});

startBtn.addEventListener('click', () => {
  state.gameStarted = true;
  state.gameOver = false;
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  updateHud();
});

restartBtn.addEventListener('click', () => {
  // Reset game state
  state.gold = 180;
  state.lives = 12;
  state.wave = 0;
  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.selectedTowerId = null;
  state.waveActive = false;
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.gameOver = false;
  state.gameStarted = true;
  gameOverScreen.classList.add('hidden');
  updateHud();
});

function spawnEnemy(template) {
  state.enemies.push({
    id: crypto.randomUUID(),
    hp: template.hp,
    maxHp: template.hp,
    speed: template.speed,
    reward: template.reward,
    color: template.color,
    distance: 0,
    radius: 12,
  });
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 80 + Math.random() * 40;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.4,
      color,
      size: 3 + Math.random() * 2,
    });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 120 * dt; // gravity

    if (p.age >= p.life) {
      state.particles.splice(i, 1);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const target = state.enemies.find((enemy) => enemy.id === projectile.targetId);

    if (!target) {
      state.projectiles.splice(i, 1);
      continue;
    }

    const dx = target.x - projectile.x;
    const dy = target.y - projectile.y;
    const distanceToTarget = Math.hypot(dx, dy);

    if (distanceToTarget <= 6) {
      target.hp -= projectile.damage;
      createParticles(target.x, target.y, 'rgba(127, 198, 181, 0.6)', 6);
      state.projectiles.splice(i, 1);
      if (target.hp <= 0) {
        state.gold += target.reward;
        state.enemies = state.enemies.filter((enemy) => enemy.id !== target.id);
        createParticles(target.x, target.y, target.color, 10);
        playSound('kill');
      }
      continue;
    }

    const step = projectile.speed * dt;
    projectile.x += (dx / distanceToTarget) * step;
    projectile.y += (dy / distanceToTarget) * step;
  }
}

function updateEnemies(dt) {
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    enemy.distance += enemy.speed * dt;

    const position = getPointOnPath(enemy.distance);
    enemy.x = position.x;
    enemy.y = position.y;

    if (enemy.distance >= pathLength) {
      state.lives -= 1;
      state.enemies.splice(i, 1);
      playSound('lose');
      if (state.lives <= 0) {
        state.gameOver = true;
        state.waveActive = false;
        state.spawnQueue = [];
        finalWaveDisplay.textContent = `Wave completed: ${state.wave}`;
        gameOverScreen.classList.remove('hidden');
      }
    }
  }
}

function updateTowers(dt) {
  for (const tower of state.towers) {
    tower.fireCooldown -= dt;
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    for (const enemy of state.enemies) {
      const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
      if (d < tower.range && d < nearestDistance) {
        nearestDistance = d;
        nearestEnemy = enemy;
      }
    }

    if (!nearestEnemy || tower.fireCooldown > 0) {
      continue;
    }

    const dx = nearestEnemy.x - tower.x;
    const dy = nearestEnemy.y - tower.y;
    const angle = Math.atan2(dy, dx);
    const speed = towerTypes[tower.type].bulletSpeed;

    state.projectiles.push({
      x: tower.x,
      y: tower.y,
      targetId: nearestEnemy.id,
      speed,
      damage: tower.damage,
      angle,
    });

    tower.fireCooldown = tower.fireRate;
    playSound('fire');
  }
}

function updateWave(dt) {
  if (!state.waveActive) {
    return;
  }

  state.spawnTimer -= dt;
  if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
    const next = state.spawnQueue.shift();
    spawnEnemy(next);
    state.spawnTimer = Math.max(0.35, 0.9 - state.wave * 0.05);
  }

  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.waveActive = false;
  }
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(name) {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.connect(gain);
  gain.connect(audioContext.destination);

  switch (name) {
    case 'place':
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
      break;
    case 'upgrade':
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
      break;
    case 'fire':
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
    case 'kill':
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'wave':
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    case 'lose':
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
  }
}

function renderGrid() {
  ctx.clearRect(0, 0, board.width, board.height);

  const bgGradient = ctx.createLinearGradient(0, 0, 0, board.height);
  bgGradient.addColorStop(0, '#f7f3ee');
  bgGradient.addColorStop(1, '#edf2f2');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, board.width, board.height);

  ctx.strokeStyle = 'rgba(29, 44, 57, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= board.width; x += board.cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
  for (let y = 0; y <= board.height; y += board.cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(board.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#bbdfe9';
  ctx.lineWidth = 24;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i += 1) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(180, 214, 232, 0.25)';
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  for (let i = 1; i < pathPoints.length; i += 1) {
    ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
  }
  ctx.lineTo(pathPoints[pathPoints.length - 1].x, pathPoints[pathPoints.length - 1].y + 28);
  ctx.lineTo(pathPoints[0].x, pathPoints[0].y + 28);
  ctx.closePath();
  ctx.fill();
}

function renderParticles() {
  for (const p of state.particles) {
    const alpha = 1 - p.age / p.life;
    ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderProjectiles() {
  for (const projectile of state.projectiles) {
    ctx.beginPath();
    ctx.fillStyle = '#7c99ae';
    ctx.arc(projectile.x, projectile.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderEnemies() {
  for (const enemy of state.enemies) {
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);

    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eaf3f5';
    ctx.fillRect(enemy.x - 14, enemy.y - 19, 28, 5);
    ctx.fillStyle = '#7fc6b5';
    ctx.fillRect(enemy.x - 14, enemy.y - 19, 28 * hpRatio, 5);
  }
}

function renderTowers() {
  for (const tower of state.towers) {
    ctx.beginPath();
    ctx.fillStyle = tower.color;
    ctx.arc(tower.x, tower.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = tower.accent;
    ctx.arc(tower.x, tower.y, 7, 0, Math.PI * 2);
    ctx.fill();

    if (state.selectedTowerId === tower.id) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(45, 126, 201, 0.28)';
      ctx.lineWidth = 1.2;
      ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function renderHudText() {
  if (!state.gameStarted) {
    ctx.fillStyle = 'rgba(29, 44, 57, 0.15)';
    ctx.font = '18px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Click Play to begin', board.width / 2, board.height / 2);
  }
}

function draw() {
  renderGrid();
  renderParticles();
  renderProjectiles();
  renderEnemies();
  renderTowers();
  renderHudText();
}

function tick(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.031);
  state.lastTime = timestamp;

  if (!state.gameOver && state.gameStarted) {
    updateTowers(dt);
    updateWave(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
  }

  draw();
  if (state.gameStarted) {
    updateHud();
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

window.addEventListener('resize', () => {
  if (state.gameStarted) {
    updateHud();
  }
});

updateHud();
