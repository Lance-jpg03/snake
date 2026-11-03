'use client';

import React, { useState, useEffect } from 'react';

// ==========================================
// TYPES
// ==========================================
type ColorId = 'red' | 'blue' | 'green' | 'yellow' | 'pink' | 'white';

interface ColorOption {
  id: ColorId;
  name: string;
  hex: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-3
}

interface Player {
  id: number;
  name: string;
  coins: number;
}

type GamePhase = 'SETUP' | 'BETTING' | 'ROLLING' | 'RESULT' | 'CONSEQUENCE' | 'GAME_OVER';

const COLORS: ColorOption[] = [
  { id: 'red', name: 'Red', hex: '#ef4444' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6' },
  { id: 'green', name: 'Green', hex: '#22c55e' },
  { id: 'yellow', name: 'Yellow', hex: '#eab308' },
  { id: 'pink', name: 'Pink', hex: '#ec4899' },
  { id: 'white', name: 'White', hex: '#f8fafc' },
];

// ==========================================
// AUDIO SYNTHESIZER
// ==========================================
class SoundFX {
  private ctx: AudioContext | null = null;
  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }
  playRoll() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150 + Math.random() * 200, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }
  playWin() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.3);
    });
  }
  playLose() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [300, 260, 220].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      gain.gain.setValueAtTime(0.2, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.25);
    });
  }
}
const soundFx = new SoundFX();

// ==========================================
// FILE PARSER UTILS
// ==========================================
function parseQuestionFile(content: string, filename: string): Question[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'json') {
    try {
      const raw = JSON.parse(content);
      return raw.map((q: any, i: number) => ({
        id: q.id || `json-q-${i}`,
        question: q.question || q.text,
        options: q.options || [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
      }));
    } catch {
      return [];
    }
  }
  
  const blocks = content.split(/---|\n{3,}/).map((b) => b.trim()).filter(Boolean);
  const questions: Question[] = [];

  blocks.forEach((block, idx) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) return;

    const questionText = lines[0];
    const options: string[] = [];
    let correctAnswer = 0;

    lines.slice(1).forEach((line) => {
      const matchOpt = line.match(/^([A-Da-d])[\)\.]\s*(.+)/);
      const matchAns = line.match(/^(?:Answer|Sagot):\s*([A-Da-d0-3])/i);

      if (matchOpt) {
        options.push(matchOpt[2].trim());
      } else if (matchAns) {
        const val = matchAns[1].toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(val)) {
          correctAnswer = ['A', 'B', 'C', 'D'].indexOf(val);
        } else {
          correctAnswer = parseInt(val, 10) || 0;
        }
      }
    });

    if (options.length >= 2) {
      questions.push({
        id: `q-${idx}-${Date.now()}`,
        question: questionText,
        options,
        correctAnswer,
      });
    }
  });

  return questions;
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function ColorGamePage() {
  const [phase, setPhase] = useState<GamePhase>('SETUP');
  const [player1Name, setPlayer1Name] = useState<string>('Player 1');
  const [player2Name, setPlayer2Name] = useState<string>('Player 2');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Player 1', coins: 200 },
    { id: 2, name: 'Player 2', coins: 200 },
  ]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);

  const [selectedColor, setSelectedColor] = useState<ColorId | null>(null);
  const [betAmount, setBetAmount] = useState<number>(20);
  const [diceResults, setDiceResults] = useState<ColorId[]>(['red', 'green', 'blue']);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [consequenceOutcome, setConsequenceOutcome] = useState<string>('');

  const SKIP_FEE = 30;
  const WRONG_PENALTY = 50;
  const currentPlayer = players[activePlayerIndex];

  useEffect(() => {
    const savedGame = localStorage.getItem('perya_game_state');
    if (savedGame) {
      try {
        const data = JSON.parse(savedGame);
        if (data.phase && data.players && data.questions?.length > 0) {
          setPhase(data.phase);
          setPlayers(data.players);
          setPlayer1Name(data.players[0].name);
          setPlayer2Name(data.players[1].name);
          setQuestions(data.questions);
          setQuestionPool(data.questionPool || data.questions);
          setActivePlayerIndex(data.activePlayerIndex || 0);
        }
      } catch (e) {
        console.error('Failed to load localstorage', e);
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== 'SETUP') {
      const stateToSave = {
        phase,
        players,
        questions,
        questionPool,
        activePlayerIndex,
      };
      localStorage.setItem('perya_game_state', JSON.stringify(stateToSave));
    }
  }, [phase, players, questions, questionPool, activePlayerIndex]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseQuestionFile(content, file.name);
      if (parsed.length === 0) {
        setError('Walang valid questions na nahanap. Check ang format.');
      } else {
        setError('');
        setQuestions(parsed);
        setQuestionPool(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.length === 0) {
      setError('Mag-upload muna ng question file (.txt)!');
      return;
    }
    const initialPlayers: Player[] = [
      { id: 1, name: player1Name.trim() || 'Player 1', coins: 200 },
      { id: 2, name: player2Name.trim() || 'Player 2', coins: 200 },
    ];
    setPlayers(initialPlayers);
    setPhase('BETTING');
  };

  const handleRoll = () => {
    if (!selectedColor) return;
    setPhase('ROLLING');

    let counter = 0;
    const interval = setInterval(() => {
      soundFx.playRoll();
      setDiceResults([
        COLORS[Math.floor(Math.random() * COLORS.length)].id,
        COLORS[Math.floor(Math.random() * COLORS.length)].id,
        COLORS[Math.floor(Math.random() * COLORS.length)].id,
      ]);
      counter++;
      if (counter >= 12) {
        clearInterval(interval);
        evaluateRiggedRoll();
      }
    }, 100);
  };

  // 🎲 RIGGED / DINAYANG ROLL LOGIC (Lamang ang Bangkero)
  const evaluateRiggedRoll = () => {
    const otherColors = COLORS.filter((c) => c.id !== selectedColor);
    const finalDice: ColorId[] = [];

    const forceWin = Math.random() < 0.15; // 15% chance na manalo

    if (forceWin) {
      finalDice.push(selectedColor!);
      finalDice.push(otherColors[Math.floor(Math.random() * otherColors.length)].id);
      finalDice.push(otherColors[Math.floor(Math.random() * otherColors.length)].id);
    } else {
      finalDice.push(otherColors[Math.floor(Math.random() * otherColors.length)].id);
      finalDice.push(otherColors[Math.floor(Math.random() * otherColors.length)].id);
      finalDice.push(otherColors[Math.floor(Math.random() * otherColors.length)].id);
    }

    finalDice.sort(() => Math.random() - 0.5);
    setDiceResults(finalDice);

    const matches = finalDice.filter((c) => c === selectedColor).length;

    if (matches > 0) {
      soundFx.playWin();
      const winnings = betAmount * matches;
      updateCoins(currentPlayer.id, winnings);
      setPhase('RESULT');
    } else {
      soundFx.playLose();
      updateCoins(currentPlayer.id, -betAmount);

      setTimeout(() => {
        let pool = [...questionPool];
        if (pool.length === 0) pool = [...questions];
        const nextQ = pool.pop()!;
        setQuestionPool(pool);
        setCurrentQuestion(nextQ);
        setPhase('CONSEQUENCE');
      }, 500);
    }
  };

  const updateCoins = (playerId: number, amount: number) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          const newCoins = Math.max(0, p.coins + amount);
          return { ...p, coins: newCoins };
        }
        return p;
      })
    );
  };

  const handleSkipQuestion = () => {
    if (currentPlayer.coins < SKIP_FEE) return;
    updateCoins(currentPlayer.id, -SKIP_FEE);
    setConsequenceOutcome(`Iniwasan ang tanong! Nagbayad ng 🪙${SKIP_FEE} skip fee.`);
    setTimeout(nextTurn, 2000);
  };

  const handleAnswerQuestion = (selectedIndex: number) => {
    if (!currentQuestion) return;

    if (selectedIndex === currentQuestion.correctAnswer) {
      soundFx.playWin();
      setConsequenceOutcome('TAMA ANG SAGOT MO! 🎉 Ligtas ang coins!');
    } else {
      soundFx.playLose();
      updateCoins(currentPlayer.id, -WRONG_PENALTY);
      setConsequenceOutcome(`MALI ANG SAGOT! ❌ Nabawasan ka ng 🪙${WRONG_PENALTY} penalty.`);
    }

    setTimeout(nextTurn, 2500);
  };

  const nextTurn = () => {
    setSelectedColor(null);
    setConsequenceOutcome('');
    setCurrentQuestion(null);
    
    if (players.some((p) => p.coins <= 0)) {
      setPhase('GAME_OVER');
      return;
    }

    setActivePlayerIndex((prev) => (prev === 0 ? 1 : 0));
    setPhase('BETTING');
  };

  const resetFullGame = () => {
    localStorage.removeItem('perya_game_state');
    setPhase('SETUP');
    setQuestions([]);
    setFileName('');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      {/* SETUP PHASE */}
      {phase === 'SETUP' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <h1 className="text-3xl font-extrabold text-amber-400 text-center mb-1 uppercase tracking-wider">
            🎪 Color Game 🎪
          </h1>
          <p className="text-slate-400 text-center text-xs mb-6">(Rigged Mode: Lamang ang Bangkero 😈)</p>

          <form onSubmit={handleStartGame} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">PLAYER 1</label>
                <input
                  type="text"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-1">PLAYER 2</label>
                <input
                  type="text"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">UPLOAD QUESTION FILE (.TXT)</label>
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer bg-slate-950 hover:bg-slate-900 transition">
                <span className="text-slate-300 text-xs font-medium text-center px-2">
                  {fileName ? `📄 ${fileName}` : 'Click para mag-upload ng .txt file'}
                </span>
                <span className="text-amber-400 text-xs mt-1 font-bold">
                  {questions.length > 0 ? `✅ ${questions.length} questions loaded` : 'Format gamit ang --- divider'}
                </span>
                <input type="file" accept=".txt,.json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={questions.length === 0}
              className={`w-full py-3 rounded-xl font-bold uppercase tracking-wider text-sm transition ${
                questions.length > 0
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              Start Game 🚀
            </button>
          </form>
        </div>
      )}

      {/* ACTIVE GAME INTERFACE */}
      {phase !== 'SETUP' && phase !== 'GAME_OVER' && (
        <div className="w-full max-w-3xl flex flex-col items-center">
          {/* Scoreboard */}
          <div className="w-full grid grid-cols-2 gap-4 mb-6">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className={`p-4 rounded-xl border-2 transition ${
                  idx === activePlayerIndex
                    ? 'bg-slate-900 border-amber-400 shadow-lg scale-105'
                    : 'bg-slate-950 border-slate-800 opacity-50'
                }`}
              >
                <div className="text-xs text-slate-400 uppercase font-semibold">Player {p.id}</div>
                <div className="text-lg font-bold">{p.name}</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">🪙 {p.coins}</div>
              </div>
            ))}
          </div>

          {/* Game Stage Box */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            {/* Dice Visuals */}
            <div className="flex justify-center gap-4 mb-8">
              {diceResults.map((cId, i) => {
                const cObj = COLORS.find((c) => c.id === cId);
                return (
                  <div
                    key={i}
                    className="w-16 h-16 rounded-xl shadow-inner flex items-center justify-center border-2 border-slate-700"
                    style={{ backgroundColor: cObj?.hex }}
                  >
                    <span className="text-slate-950 font-black text-[10px] uppercase bg-white/90 px-1.5 py-0.5 rounded">
                      {cObj?.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* PHASE: BETTING */}
            {phase === 'BETTING' && (
              <div className="space-y-6">
                <h2 className="text-center font-bold text-base text-amber-300">
                  Turn ni <span className="underline">{currentPlayer.name}</span>: Pumili ng Kulay at Taya
                </h2>

                <div className="grid grid-cols-3 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedColor(c.id)}
                      className={`h-14 rounded-xl font-bold uppercase text-sm transition border-2 flex items-center justify-center ${
                        selectedColor === c.id ? 'border-white scale-95 shadow-lg' : 'border-transparent'
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        color: c.id === 'white' || c.id === 'yellow' ? '#000' : '#fff',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-1">
                  <label className="text-xs text-slate-400">Pusta: 🪙 {betAmount}</label>
                  <input
                    type="range"
                    min={10}
                    max={Math.min(currentPlayer.coins, 100)}
                    step={10}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-full max-w-sm accent-amber-400"
                  />
                </div>

                <button
                  onClick={handleRoll}
                  disabled={!selectedColor || currentPlayer.coins < betAmount}
                  className={`w-full py-3.5 rounded-xl font-black uppercase text-base transition ${
                    selectedColor && currentPlayer.coins >= betAmount
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  BAGSAK ANG KULAY! 🎲
                </button>
              </div>
            )}

            {/* PHASE: RESULT (WIN) */}
            {phase === 'RESULT' && (
              <div className="text-center space-y-4 py-6">
                <h2 className="text-3xl font-extrabold text-green-400">HIMALANG NANALO KA! 🎉</h2>
                <p className="text-slate-300 text-sm">Nakatsamba ka sa dinayang laro!</p>
                <button
                  onClick={nextTurn}
                  className="bg-amber-400 text-slate-950 font-bold px-8 py-2.5 rounded-xl uppercase text-sm hover:bg-amber-300"
                >
                  Susunod na Turn ➡️
                </button>
              </div>
            )}

            {/* PHASE: CONSEQUENCE (QUIZ OR SKIP) */}
            {phase === 'CONSEQUENCE' && currentQuestion && (
              <div className="space-y-5">
                {!consequenceOutcome ? (
                  <>
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center">
                      <h3 className="text-red-400 font-bold text-sm">TINALO KA NG BANGKERO! ❌</h3>
                      <p className="text-slate-300 text-xs">
                        Diretso sa tanong o magbayad ng skip fee para makaiwas sa penalty.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <h4 className="font-bold text-sm mb-3 text-amber-300">{currentQuestion.question}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentQuestion.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswerQuestion(i)}
                            className="p-2.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-left text-xs font-medium transition border border-slate-800"
                          >
                            <span className="text-amber-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div>
                        <div className="text-[11px] font-bold text-amber-400">IWASAN ANG TANONG (SKIP)</div>
                        <div className="text-[10px] text-slate-400">Bayad: 🪙 {SKIP_FEE} coins</div>
                      </div>
                      <button
                        onClick={handleSkipQuestion}
                        disabled={currentPlayer.coins < SKIP_FEE}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition ${
                          currentPlayer.coins >= SKIP_FEE
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        Magbayad Skip Fee
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <h3 className="text-xl font-bold">{consequenceOutcome}</h3>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={resetFullGame}
            className="mt-6 text-xs text-slate-500 underline hover:text-slate-400 transition"
          >
            ⚙️ I-reset ang Laro / Palitan ang Setup
          </button>
        </div>
      )}

      {/* GAME OVER PHASE */}
      {phase === 'GAME_OVER' && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-4">
          <h2 className="text-3xl font-black text-red-400">NAUUBOS NA ANG PERA MO! 💀</h2>
          <p className="text-slate-300 text-sm">Ginisa ka ng bangkero sa sarili mong mantika!</p>
          <button
            onClick={resetFullGame}
            className="w-full py-3 bg-amber-400 text-slate-950 rounded-xl font-bold uppercase text-sm hover:bg-amber-300 transition"
          >
            Subukang Bumawi 🔄
          </button>
        </div>
      )}
    </main>
  );
}