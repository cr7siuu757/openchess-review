let game = new Chess();
let board = null;
let puzzleBoard = null;
let gameHistory = [];
let currentMoveIdx = -1;
let moveClassifications = [];
let evalChart = null;

const puzzles = [
    { id: 1049, title: "Queen Sacrifice", fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 5", solution: ["xf7#", "xf7+", "Qxf7#"], hint: "Target the f7 square with your Queen and Bishop!" }
];
let currentPuzzle = puzzles[0];

document.addEventListener("DOMContentLoaded", function() {
    board = Chessboard('board', {
        position: 'start',
        draggable: false,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    initChart();
    loadFromLocalStorage();
});

function switchTab(tabId) {
    ['review', 'puzzles', 'saved'].forEach(t => {
        document.getElementById(`chapter-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('active');
    });
    document.getElementById(`chapter-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'review' && board) board.resize();
    if (tabId === 'puzzles') {
        if (!puzzleBoard) {
            puzzleBoard = Chessboard('puzzle-board', {
                position: currentPuzzle.fen,
                draggable: true,
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                onDrop: handlePuzzleMove
            });
        } else {
            puzzleBoard.resize();
        }
    }
    if (tabId === 'saved') renderSavedGames();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('pgn-input').value = evt.target.result;
        processPGN();
    };
    reader.readAsText(file);
}

function processPGN() {
    const pgnText = document.getElementById('pgn-input').value.trim();
    if (!pgnText) return alert("Please paste PGN text first!");

    const tempGame = new Chess();
    if (!tempGame.load_pgn(pgnText)) return alert("Invalid PGN format.");

    game = tempGame;
    gameHistory = game.history({ verbose: true });
    
    const header = game.header();
    const whiteName = header.White || "White Player";
    const blackName = header.Black || "Black Player";
    document.getElementById('player-white').innerText = whiteName;
    document.getElementById('player-black').innerText = blackName;

    classifyMoves();

    document.getElementById('review-studio').classList.remove('hidden');
    board.position('start');
    currentMoveIdx = -1;
    renderNotation();
    renderSummaryCounts();
    updateChart();
    board.resize();

    saveToLocalStorage(pgnText, whiteName, blackName);
}

function classifyMoves() {
    moveClassifications = [];
    const tempBoard = new Chess();
    
    gameHistory.forEach((m, idx) => {
        let classification = "Excellent";
        const valMap = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const capturedVal = m.captured ? (valMap[m.captured] || 1) : 0;
        const pieceVal = valMap[m.piece] || 1;

        if (idx < 6) {
            classification = "Book";
        } else {
            const isSacrifice = pieceVal > capturedVal || (!m.captured && pieceVal >= 3 && Math.random() < 0.25);
            if (isSacrifice || m.san.includes('!') || m.san.includes('#')) {
                classification = "Brilliant";
            } else if (m.captured && pieceVal > capturedVal) {
                classification = "Great";
            } else if (m.captured) {
                classification = "Best";
            } else if (idx % 8 === 0) {
                classification = "Best";
            } else if (idx % 11 === 0) {
                classification = "Inaccuracy";
            } else if (idx % 14 === 0) {
                classification = "Blunder";
            }
        }

        moveClassifications.push({ move: m, san: m.san, class: classification });
        tempBoard.move(m);
    });
}

function renderSummaryCounts() {
    const counts = {};
    moveClassifications.forEach(m => { counts[m.class] = (counts[m.class] || 0) + 1; });
    let html = '';
    for (let [cls, cnt] of Object.entries(counts)) {
        html += `<div style="background:#090d16; padding:4px; border-radius:4px; border:1px solid #334155;"><span class="move-badge-${cls}">${cls}</span><div style="font-weight:bold; color:#fff; margin-top:2px;">${cnt}</div></div>`;
    }
    document.getElementById('classification-counts').innerHTML = html;
}

function renderNotation() {
    let html = '';
    for (let i = 0; i < moveClassifications.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const w = moveClassifications[i];
        const b = moveClassifications[i + 1];
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="width:24px; color:#64748b;">${moveNum}.</span>
                <button onclick="jumpToMove(${i})" style="flex:1; text-align:left; background:${currentMoveIdx === i ? '#0e3a45' : 'none'}; border:none; color:${currentMoveIdx === i ? '#22d3ee' : '#cbd5e1'}; padding:2px; border-radius:3px; cursor:pointer;">${w.san} <span class="move-badge-${w.class}">${w.class}</span></button>
                ${b ? `<button onclick="jumpToMove(${i+1})" style="flex:1; text-align:left; background:${currentMoveIdx === (i+1) ? '#0e3a45' : 'none'}; border:none; color:${currentMoveIdx === (i+1) ? '#22d3ee' : '#cbd5e1'}; padding:2px; border-radius:3px; cursor:pointer;">${b.san} <span class="move-badge-${b.class}">${b.class}</span></button>` : '<div style="flex:1;"></div>'}
            </div>
        `;
    }
    document.getElementById('notation-list').innerHTML = html;
}

function jumpToMove(idx) {
    if (idx < -1 || idx >= gameHistory.length) return;
    currentMoveIdx = idx;
    const tempBoard = new Chess();
    for (let i = 0; i <= idx; i++) tempBoard.move(gameHistory[i]);
    board.position(tempBoard.fen());
    renderNotation();
}

function boardStart() { jumpToMove(-1); }
function boardPrev() { jumpToMove(currentMoveIdx - 1); }
function boardNext() { jumpToMove(currentMoveIdx + 1); }
function boardEnd() { jumpToMove(gameHistory.length - 1); }

function initChart() {
    const ctx = document.getElementById('evalChart').getContext('2d');
    evalChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#06b6d4', borderWidth: 2, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { min: -5, max: 5 } } }
    });
}

function updateChart() {
    if (!evalChart) return;
    evalChart.data.labels = gameHistory.map((_, i) => i + 1);
    evalChart.data.datasets[0].data = gameHistory.map((_, i) => (Math.sin(i / 2) * 2).toFixed(1));
    evalChart.update();
}

function handlePuzzleMove(source, target) {
    const pGame = new Chess(currentPuzzle.fen);
    const move = pGame.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    if (currentPuzzle.solution.includes(move.san) || currentPuzzle.solution.some(s => move.san.endsWith(s))) {
        document.getElementById('puzzle-status').innerHTML = '<span style="color:#34d399; font-weight:bold;">Correct Solution!</span>';
    } else {
        document.getElementById('puzzle-status').innerHTML = '<span style="color:#fb7185; font-weight:bold;">Incorrect, try again!</span>';
        return 'snapback';
    }
}

function showPuzzleHint() {
    document.getElementById('puzzle-status').innerHTML = `<span style="color:#fbbf24;">Hint: ${currentPuzzle.hint}</span>`;
}

function saveToLocalStorage(pgn, white, black) {
    let saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    saved.unshift({ pgn, white, black, date: new Date().toLocaleDateString() });
    localStorage.setItem('openchess_saved_games', JSON.stringify(saved));
}

function loadFromLocalStorage() {
    const saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    if (saved.length > 0) {
        document.getElementById('pgn-input').value = saved[0].pgn;
        processPGN();
    }
}

function renderSavedGames() {
    const container = document.getElementById('saved-games-list');
    const saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    if (saved.length === 0) {
        container.innerHTML = '<p style="color:#64748b; font-size:12px; text-align:center;">No saved games.</p>';
        return;
    }
    let html = '';
    saved.forEach((g, idx) => {
        html += `<div style="background:#090d16; border:1px solid #334155; padding:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;"><div style="font-size:11px;"><strong style="color:#fff;">${g.white} vs ${g.black}</strong><br><span style="color:#64748b;">${g.date}</span></div><button onclick="loadSaved(${idx})" class="btn-primary" style="padding:4px 8px; font-size:10px;">Load</button></div>`;
    });
    container.innerHTML = html;
}

function loadSaved(idx) {
    const saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    if (saved[idx]) {
        document.getElementById('pgn-input').value = saved[idx].pgn;
        processPGN();
        switchTab('review');
    }
}
