const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const COLS = 10, ROWS = 20, BLOCK = 30; // bigger blocks
const colors = [null,'#00ffff','#0000ff','#ffa500','#ffff00','#00ff00','#800080','#ff0000'];

const arena = makeMatrix(COLS, ROWS);
let opponentState = null;
let gameOver = false;

function makeMatrix(w,h){ const m=[]; while(h--) m.push(new Array(w).fill(0)); return m; }

const TETROMINOES = {
  I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J:[[2,0,0],[2,2,2],[0,0,0]],
  L:[[0,0,3],[3,3,3],[0,0,0]],
  O:[[4,4],[4,4]],
  S:[[0,5,5],[5,5,0],[0,0,0]],
  T:[[0,6,0],[6,6,6],[0,0,0]],
  Z:[[7,7,0],[0,7,7],[0,0,0]]
};

function rotate(m,dir){ for(let y=0;y<m.length;y++) for(let x=0;x<y;x++) [m[x][y],m[y][x]]=[m[y][x],m[x][y]]; if(dir>0) m.forEach(r=>r.reverse()); else m.reverse(); }

class Player{
  constructor(){ this.score=0; this.reset(); }
  reset(){ this.matrix=null; this.pos={x:3,y:0}; this.queue=this.generateQueue(); this.nextPiece(); }
  generateQueue(){ const shapes=Object.keys(TETROMINOES); const bag=[]; while(shapes.length){ const r=shapes.splice(Math.floor(Math.random()*shapes.length),1)[0]; bag.push(r); } return bag; }
  nextPiece(){ if(!this.queue.length)this.queue=this.generateQueue(); const key=this.queue.shift(); this.matrix=TETROMINOES[key].map(r=>r.slice()); this.pos={x:Math.floor((COLS-this.matrix[0].length)/2),y:0}; }
}

const player=new Player();
let dropCounter=0;
let dropInterval=500; // faster start
let lastTime=0;

function collide(arena,player){ const m=player.matrix; for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]!==0 && (arena[y+player.pos.y] && arena[y+player.pos.y][x+player.pos.x])!==0) return true; return false; }

function merge(arena,player){ player.matrix.forEach((row,y)=>row.forEach((v,x)=>{ if(v) arena[y+player.pos.y][x+player.pos.x]=v; })); }

function sweep(){
  let lines=0;
  outer:for(let y=arena.length-1;y>=0;y--){
    for(let x=0;x<arena[y].length;x++) if(!arena[y][x]) continue outer;
    const row=arena.splice(y,1)[0].fill(0); arena.unshift(row); lines++; y++;
  }
  if(lines>0){
    const scoreTable=[0,40,100,300,1200];
    player.score+=scoreTable[lines];
    updateScore();
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  return lines;
}

function playerDrop(){ player.pos.y++; if(collide(arena,player)){ player.pos.y--; merge(arena,player); sweep(); player.nextPiece(); if(collide(arena,player)){ gameOver=true; document.getElementById('statustxt').innerText='Game Over'; } } dropCounter=0; }

function hardDrop(){ while(!collide(arena,player)) player.pos.y++; player.pos.y--; merge(arena,player); sweep(); player.nextPiece(); }

function playerMove(dir){ player.pos.x+=dir; if(collide(arena,player)) player.pos.x-=dir; }

function playerRotate(dir){ const pos=player.pos.x; let offset=1; rotate(player.matrix,dir); while(collide(arena,player)){ player.pos.x+=offset; offset=-(offset+(offset>0?1:-1)); if(offset>player.matrix[0].length){ rotate(player.matrix,-dir); player.pos.x=pos; return; } } }

function drawMatrix(m,offset){ m.forEach((row,y)=>row.forEach((v,x)=>{ if(v){ ctx.fillStyle=colors[v]; ctx.fillRect((x+offset.x)*BLOCK,(y+offset.y)*BLOCK,BLOCK,BLOCK); ctx.strokeStyle='#09121b'; ctx.strokeRect((x+offset.x)*BLOCK,(y+offset.y)*BLOCK,BLOCK,BLOCK); } })); }

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  arena.forEach((row,y)=>row.forEach((v,x)=>{ ctx.fillStyle=v?colors[v]:'#071029'; ctx.fillRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK); }));
  drawMatrix(player.matrix,player.pos);

  // draw opponent preview
  const oppCanvas=document.getElementById('oppBoard');
  const oppCtx=oppCanvas.getContext('2d');
  oppCtx.clearRect(0,0,oppCanvas.width,oppCanvas.height);
  if(opponentState && opponentState.arena){
    const scale=oppCanvas.width/COLS/BLOCK;
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      const v=opponentState.arena[y]?opponentState.arena[y][x]:0;
      if(v){ oppCtx.fillStyle=colors[v]; oppCtx.fillRect(x*BLOCK*scale,y*BLOCK*scale,BLOCK*scale,BLOCK*scale); }
    }
  }
}

function update(time=0){
  const delta=time-lastTime; lastTime=time; dropCounter+=delta;
  dropInterval=500-Math.min(400,Math.floor(player.score/100)*20);
  if(!gameOver && dropCounter>dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
}

function updateScore(){ document.getElementById('scoreVal').innerText=player.score; }

// Desktop controls
document.addEventListener('keydown', e=>{
  if(gameOver) return;
  if(e.key==='ArrowLeft'||e.key==='a') playerMove(-1);
  else if(e.key==='ArrowRight'||e.key==='d') playerMove(1);
  else if(e.key==='ArrowDown'||e.key==='s'){ playerDrop(); player.score++; updateScore(); }
  else if(e.key==='ArrowUp'||e.key==='x'||e.key==='w') playerRotate(1);
  else if(e.key==='z') playerRotate(-1);
  else if(e.key===' ') hardDrop();
});

// Mobile controls
const mobileMap={ left:()=>playerMove(-1), right:()=>playerMove(1), rotate:()=>playerRotate(1), down:()=>{ playerDrop(); player.score++; updateScore(); } };
['btn-left','btn-right','btn-rotate','btn-drop'].forEach(id=>{
  const btn=document.getElementById(id);
  if(!btn) return;
  const key=id.replace('btn-','');
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); mobileMap[key](); }, {passive:false});
  btn.addEventListener('click', e=>{ mobileMap[key](); });
});

player.nextPiece();
updateScore();
requestAnimationFrame(update);

window.__game={ arena, player, getPublicState:()=>({arena,score:player.score}), onOpponentState:(state)=>{ opponentState=state; }, playerMove, playerRotate, playerDrop, hardDrop };
