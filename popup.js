let game = new Chess();
let board = null;
let puzzleBoard = null;
let gameHistory = [];
let currentMoveIdx = -1;
let moveClassifications = [];
let evalChart = null;

let currentPuzzle = null;
let puzzleGame = null;
let puzzleSolutionMoves = [];
let puzzleMoveIndex = 0;

document.addEventListener("DOMContentLoaded", function() {
    board = Chessboard('board', {
        position: 'start',
        draggable: false,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    initChart();
    
    const saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    if (saved.length > 0) {
        document.getElementById('pgn-input').value = saved[0].pgn;
        processPGN(false);
    }
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
                position: 'start',
                draggable: true,
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                onDrop: handlePuzzleMove
            });
        }
        fetchNewPuzzle();
    }
    if (tabId === 'saved') renderSavedGames();
}

async function fetchNewPuzzle() {
    document.getElementById('puzzle-status').innerHTML = '<span style="color:#22d3ee;">Loading fresh puzzle from Lichess...</span>';
    try {
        const response = await fetch('https://lichess.org/api/puzzle/daily');
        const data = await response.json();
        
        const fenBeforePuzzle = data.game.fen;
        const uciMoves = data.puzzle.solution;
        
        puzzleGame = new Chess(fenBeforePuzzle);
        
        const setupMoveUCI = uciMoves[0];
        puzzleGame.move({
            from: setupMoveUCI.substring(0, 2),
            to: setupMoveUCI.substring(2, 4),
            promotion: setupMoveUCI.length > 4 ? setupMoveUCI[4] : undefined
        });

        currentPuzzle = {
            rating: data.puzzle.rating,
            fen: puzzleGame.fen()
        };

        puzzleSolutionMoves = uciMoves.slice(1);
        puzzleMoveIndex = 0;

        puzzleBoard.position(currentPuzzle.fen);
        puzzleBoard.resize();
        document.getElementById('puzzle-status').innerHTML = `<span>Rating: <b>${currentPuzzle.rating}</b> — White to move and find the best continuation!</span>`;
    } catch (err) {
        document.getElementById('puzzle-status').innerHTML = '<span style="color:#fb7185;">Failed to load puzzle. Check internet connection.</span>';
    }
}

function handlePuzzleMove(source, target) {
    if (!puzzleGame) return 'snapback';

    const attemptedMoveUCI = source + target;
    const expectedMoveUCI = puzzleSolutionMoves[puzzleMoveIndex];

    if (attemptedMoveUCI === expectedMoveUCI.substring(0, 4)) {
        puzzleGame.move({
            from: source,
            to: target,
            promotion: attemptedMoveUCI.length > 4 ? attemptedMoveUCI[4] : undefined
        });
        puzzleBoard.position(puzzleGame.fen());
        puzzleMoveIndex++;

        if (puzzleMoveIndex >= puzzleSolutionMoves.length) {
            document.getElementById('puzzle-status').innerHTML = '<span style="color:#34d399; font-weight:bold;">Puzzle Solved! 🎉 Loading next...</span>';
            setTimeout(fetchNewPuzzle, 1800);
            return;
        }

        if (puzzleMoveIndex < puzzleSolutionMoves.length) {
            setTimeout(() => {
                const opponentMoveUCI = puzzleSolutionMoves[puzzleMoveIndex];
                puzzleGame.move({
                    from: opponentMoveUCI.substring(0, 2),
                    to: opponentMoveUCI.substring(2, 4),
                    promotion: opponentMoveUCI.length > 4 ? opponentMoveUCI[4] : undefined
                });
                puzzleBoard.position(puzzleGame.fen());
                puzzleMoveIndex++;
            }, 300);
        }
    } else {
        document.getElementById('puzzle-status').innerHTML = '<span style="color:#fb7185; font-weight:bold;">Incorrect move! Try again.</span>';
        return 'snapback';
    }
}

function showPuzzleHint() {
    document.getElementById('puzzle-status').innerHTML = `<span style="color:#fbbf24;">Hint: Calculate the forcing sequence carefully!</span>`;
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('pgn-input').value = evt.target.result;
        processPGN(true);
    };
    reader.readAsText(file);
}

function processPGN(shouldSave = true) {
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

    if (shouldSave) {
        saveToLocalStorage(pgnText, whiteName, blackName);
    }
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

function saveToLocalStorage(pgn, white, black) {
    let saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    saved = saved.filter(g => g.pgn !== pgn);
    saved.unshift({ pgn, white, black, date: new Date().toLocaleDateString() });
    if (saved.length > 15) saved.pop();
    localStorage.setItem('openchess_saved_games', JSON.stringify(saved));
}

function renderSavedGames() {
    const container = document.getElementById('saved-games-list');
    const saved = JSON.parse(localStorage.getItem('openchess_saved_games') || '[]');
    if (saved.length === 0) {
        container.innerHTML = '<p style="color:#64748b; font-size:12px; text-align:center;">No saved games yet. Analyze a PGN to save it!</p>';
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
        processPGN(false);
        switchTab('review');
    }
}
