const socket=io();
let currentRoom=null;
let opponent=null;

const btnQueue=document.getElementById('btn-queue');
const btnLeave=document.getElementById('btn-leave');
const usernameInput=document.getElementById('username');
const statusTxt=document.getElementById('statustxt');

btnQueue.onclick=()=>{
  const username=usernameInput.value.trim()||'Anon';
  socket.emit('set-username',{username}); // online tracking
  socket.emit('join-queue',{username});
  btnQueue.style.display='none';
  btnLeave.style.display='inline-block';
  statusTxt.innerText='Searching...';
};

btnLeave.onclick=()=>{
  socket.emit('leave-queue');
  btnQueue.style.display='inline-block';
  btnLeave.style.display='none';
  statusTxt.innerText='Idle';
};

// Leaderboard
document.getElementById('btn-leaderboard').onclick=async()=>{
  const res=await fetch('/api/leaderboard?limit=20');
  const rows=await res.json();
  const ol=document.getElementById('leader-list'); ol.innerHTML='';
  rows.forEach(r=>{ const li=document.createElement('li'); li.textContent=`${r.username} — ${r.score}`; ol.appendChild(li); });
  document.getElementById('leaderboard').style.display='block';
};
document.getElementById('close-leader').onclick=()=>{ document.getElementById('leaderboard').style.display='none'; };

// Match found
socket.on('matched',({roomId,opponent:otherName})=>{
  currentRoom=roomId;
  opponent=otherName||'Opponent';
  statusTxt.innerText='Matched vs '+opponent;
  startSync();
});

socket.on('queued',()=>{ statusTxt.innerText='Queued'; });
socket.on('opponent-disconnect',()=>{ statusTxt.innerText='Opponent disconnected'; stopSync(); });

// Online users
socket.on('online-users', users=>{
  const ul=document.getElementById('online-list');
  if(!ul) return; ul.innerHTML='';
  users.forEach(u=>{ const li=document.createElement('li'); li.textContent=u.username; ul.appendChild(li); });
});

// Game relay
let syncInterval=null;
function startSync(){ if(syncInterval) clearInterval(syncInterval); syncInterval=setInterval(()=>{ const state={arena:window.__game.arena.map(r=>r.slice()), score:window.__game.player.score}; if(currentRoom) socket.emit('game-event',{roomId:currentRoom,type:'state',payload:state}); },250); }

function stopSync(){ if(syncInterval) clearInterval(syncInterval); syncInterval=null; currentRoom=null; }

socket.on('game-event',({from,type,payload})=>{
  if(type==='state'){ window.__game.onOpponentState(payload); }
  else if(type==='lost'){ statusTxt.innerText='You Win!'; window.__game.gameOver=true; stopSync(); submitScore(); }
});

// Check local loss
setInterval(()=>{ if(window.__game.player.pos && window.__game.player.pos.y===0 && window.__game.arena[0].some(v=>v!==0)){ if(currentRoom) socket.emit('game-event',{roomId:currentRoom,type:'lost',payload:{}}); statusTxt.innerText='You Lost'; stopSync(); submitScore(); } },500);

async function submitScore(){
  try{
    const username=usernameInput.value.trim()||'Anon';
    const score=window.__game.player.score||0;
    await fetch('/api/score',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,score})});
  }catch(e){ console.warn('score submit failed',e); }
}
