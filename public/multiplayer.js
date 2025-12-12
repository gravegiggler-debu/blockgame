// public/multiplayer.js
const socket = io();
let currentRoom = null;
let opponent = null;
let queued = false;

const btnQueue = document.getElementById('btn-queue');
const btnLeave = document.getElementById('btn-leave');
const usernameInput = document.getElementById('username');
const statusTxt = document.getElementById('statustxt');

btnQueue.onclick = () => {
  const username = usernameInput.value.trim() || 'Anon';
  socket.emit('join-queue', { username });
  btnQueue.style.display = 'none';
  btnLeave.style.display = 'inline-block';
  statusTxt.innerText = 'Searching...';
};

btnLeave.onclick = () => {
  socket.emit('leave-queue');
  btnQueue.style.display = 'inline-block';
  btnLeave.style.display = 'none';
  statusTxt.innerText = 'Idle';
};

document.getElementById('btn-leaderboard').onclick = async () => {
  const res = await fetch('/api/leaderboard?limit=20');
  const rows = await res.json();
  const ol = document.getElementById('leader-list');
  ol.innerHTML = '';
  rows.forEach(r => {
    const li = document.createElement('li');
    li.textContent = `${r.username} — ${r.score}`;
    ol.appendChild(li);
  });
  document.getElementById('leaderboard').style.display = 'block';
};

document.getElementById('close-leader').onclick = () => {
  document.getElementById('leaderboard').style.display = 'none';
};

// Match found
socket.on('matched', ({ roomId, opponent: otherName }) => {
  currentRoom = roomId;
  opponent = otherName || 'Opponent';
  document.getElementById('statustxt').innerText = 'Matched vs ' + opponent;
  // join already done server-side; start sending periodic snapshots
  startSync();
});

socket.on('queued', () => {
  queued = true;
  statusTxt.innerText = 'Queued';
});

socket.on('opponent-disconnect', () => {
  statusTxt.innerText = 'Opponent disconnected';
  stopSync();
});

// Relay game events: we send "game-event" with type and payload
let syncInterval = null;
function startSync() {
  if (syncInterval) clearInterval(syncInterval);
  // every 250ms send a snapshot of arena and score
  syncInterval = setInterval(() => {
    const state = {
      arena: window.__game.arena.map(r => r.slice()),
      score: window.__game.player.score
    };
    socket.emit('game-event', { roomId: currentRoom, type: 'state', payload: state });
  }, 250);
}

function stopSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
  currentRoom = null;
}

// receive relays
socket.on('game-event', ({ from, type, payload }) => {
  if (type === 'state') {
    // display opponent arena and score (preview)
    window.__game.onOpponentState(payload);
  } else if (type === 'lost') {
    // opponent lost — you win
    document.getElementById('statustxt').innerText = 'You Win!';
    window.__game.endGame();
    submitScore();
    stopSync();
  } else if (type === 'sendGarbage') {
    // TODO: implement garbage mechanic if you wish
  }
});

// hook into local game loss: monitor arena top filled
function checkLocalLoss() {
  if (window.__game.player.pos && window.__game.player.pos.y === 0 && collideTop()) {
    // send lost
    if (currentRoom) socket.emit('game-event', { roomId: currentRoom, type: 'lost', payload: {} });
    document.getElementById('statustxt').innerText = 'You Lost';
    submitScore();
    stopSync();
  }
}
function collideTop() {
  // simple check: any block in top row
  return window.__game.arena[0].some(v => v !== 0);
}
// periodically check
setInterval(() => {
  try { checkLocalLoss(); } catch(e){}
}, 500);

// submit score to leaderboard
async function submitScore() {
  try {
    const username = (usernameInput.value.trim() || 'Anon');
    const score = window.__game.player.score || 0;
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score })
    });
  } catch (err) {
    console.warn('score submit failed', err);
  }
}
