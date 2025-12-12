// public/game.js
// Minimal Tetris logic (single-file, easy to extend)
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const COLS = 10, ROWS = 20, BLOCK = 20;
const previewCanvas = null;

const colors = [null, '#00ffff','#0000ff','#ffa500','#ffff00','#00ff00','#800080','#ff0000'];

function makeMatrix(w,h){
  const m = [];
  while(h--) m.push(new Array(w).fill(0));
  return m;
}

// Tetrominoes as matrices
const TETROMINOES = {
  'I': [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  'J': [[2,0,0],[2,2,2],[0,0,0]],
  'L': [[0,0,3],[3,3,3],[0,0,0]],
  'O': [[4,4],[4,4]],
  'S': [[0,5,5],[5,5,0],[0,0,0]],
  'T': [[0,6,0],[6,6,6],[0,0,0]],
  'Z': [[7,7,0],[0,7,7],[0,0,0]]
};

function rotate(matrix, dir) {
  for (let y=0; y<matrix.length; ++y)
    for (let x=0; x<y; ++x)
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

class Player {
  constructor() {
    this.reset();
    this.score = 0;
  }
  reset() {
    this.matrix = null;
    this.pos = {x: 3, y: 0};
    this.queue = this.generateQueue();
  }
  generateQueue() {
    const shapes = Object.keys(TETROMINOES);
    const bag = [];
    // simple bag algorithm
    while (bag.length < 7) {
      const r = shapes.splice(Math.floor(Math.random()*shapes.length),1)[0];
      bag.push(r);
    }
    return bag;
  }
  nextPiece() {
    if (!this.queue.length) this.queue = this.generateQueue();
    const key = this.queue.shift();
    // deep copy matrix
    this.matrix = TETROMINOES[key].map(r => r.slice());
    this.pos = { x: Math.floor((COLS - this.matrix[0].length)/2), y: 0 };
    return key;
  }
}

const arena = makeMatrix(COLS, ROWS);
const player = new Player();
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameOver = false;
let opponentState = null;

function collide(arena, player) {
  const m = player.matrix;
  for (let y=0;y<m.length;y++){
    for (let x=0;x<m[y].length;x++){
      if (m[y][x] && (arena[y+player.pos.y] && arena[y+player.pos.y][x+player.pos.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, player) {
  const m = player.matrix;
  for (let y=0;y<m.length;y++){
    for (let x=0;x<m[y].length;x++){
      if (m[y][x]) arena[y+player.pos.y][x+player.pos.x] = m[y][x];
    }
  }
}

function sweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (!arena[y][x]) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++rowCount;
    ++y;
  }
  if (rowCount > 0) {
    const scoring = [0, 40, 100, 300, 1200];
    player.score += scoring[rowCount];
    updateScore();
  }
  return rowCount;
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    const cleared = sweep();
    player.nextPiece();
    if (collide(arena, player)) {
      // game over
      gameOver = true;
      document.getElementById('statustxt').innerText = 'Game Over';
    }
  }
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) player.pos.x -= dir;
}

function playerRotate(dir) {
  rotate(player.matrix, dir);
  let offset = 1;
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      return;
    }
  }
}

function drawMatrix(m, offset, scale=1, ctxLocal=ctx) {
  for (let y=0;y<m.length;y++){
    for (let x=0;x<m[y].length;x++){
      if (m[y][x]) {
        ctxLocal.fillStyle = colors[m[y][x]];
        ctxLocal.fillRect((x+offset.x)*BLOCK, (y+offset.y)*BLOCK, BLOCK, BLOCK);
        ctxLocal.strokeStyle = '#09121b';
        ctxLocal.strokeRect((x+offset.x)*BLOCK, (y+offset.y)*BLOCK, BLOCK, BLOCK);
      }
    }
  }
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw arena
  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      const v = arena[y][x];
      if (v) {
        ctx.fillStyle = colors[v];
        ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
        ctx.strokeStyle = '#09121b';
        ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
      } else {
        ctx.fillStyle = '#071029';
        ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
      }
    }
  }
  if (player.matrix) drawMatrix(player.matrix, player.pos);
  // draw opponent preview if present
  const oppCanvas = document.getElementById('oppBoard');
  const oppCtx = oppCanvas.getContext('2d');
  oppCtx.clearRect(0,0,oppCanvas.width, oppCanvas.height);
  if (opponentState && opponentState.arena) {
    const scale = 0.5;
    const bSize = BLOCK * scale;
    for (let y=0;y<ROWS;y++){
      for (let x=0;x<COLS;x++){
        const v = opponentState.arena[y] ? opponentState.arena[y][x] : 0;
        if (v) {
          oppCtx.fillStyle = colors[v];
          oppCtx.fillRect(x*bSize, y*bSize, bSize, bSize);
        }
      }
    }
  }
}

function update(time = 0) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval && !gameOver) {
    playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

function updateScore() {
  document.getElementById('scoreVal').innerText = player.score;
}

document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') playerMove(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd') playerMove(1);
  else if (e.key === 'ArrowDown' || e.key === 's') { playerDrop(); player.score += 1; updateScore(); }
  else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'w') playerRotate(1);
  else if (e.key === 'z') playerRotate(-1);
});

// init
player.nextPiece();
updateScore();
requestAnimationFrame(update);

// expose to multiplayer wrapper
window.__game = {
  arena, player, getPublicState: () => ({ arena, score: player.score }),
  sendGarbage: (lines) => {
    // not implemented in core; multiplayer will listen for cleared lines
    // We'll provide a hook that multiplayer can call if needed
    console.log('sendGarbage hook', lines);
  },
  onOpponentState: (state) => {
    opponentState = state;
  },
  endGame: () => { gameOver = true; document.getElementById('statustxt').innerText = 'Game Over'; }
};
