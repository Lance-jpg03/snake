'use client';

import { useState, useEffect } from 'react';
import { Question } from '@/app/page';

interface GameBoardProps {
  questions: Question[];
  onBackToSetup: () => void;
}

interface Player {
  id: number;
  name: string;
  position: number;
  color: string;
}

export default function GameBoard({ questions, onBackToSetup }: GameBoardProps) {
  const [players, setPlayers] = useState<Player[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_players');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { /* fallback */ }
      }
    }
    return [
      { id: 1, name: 'Player 1', position: 1, color: 'bg-red-500' },
      { id: 2, name: 'Player 2', position: 1, color: 'bg-blue-500' },
    ];
  });

  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_turn');
      if (saved !== null) return parseInt(saved, 10);
    }
    return 0;
  });

  const [diceResult, setDiceResult] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_dice');
      if (saved !== null) return parseInt(saved, 10);
    }
    return null;
  });

  const [message, setMessage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_message');
      if (saved) return saved;
    }
    return "Player 1's turn. Roll the dice!";
  });

  const [activeQuestion, setActiveQuestion] = useState<Question | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_active_question');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { /* fallback */ }
      }
    }
    return null;
  });

  const [winner, setWinner] = useState<Player | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake_winner');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { /* fallback */ }
      }
    }
    return null;
  });

  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Save state changes automatically to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('snake_players', JSON.stringify(players));
      localStorage.setItem('snake_turn', currentTurnIndex.toString());
      localStorage.setItem('snake_dice', diceResult !== null ? diceResult.toString() : '');
      localStorage.setItem('snake_message', message);
      localStorage.setItem('snake_active_question', activeQuestion ? JSON.stringify(activeQuestion) : '');
      localStorage.setItem('snake_winner', winner ? JSON.stringify(winner) : '');
    }
  }, [players, currentTurnIndex, diceResult, message, activeQuestion, winner]);

  const ladders: { [key: number]: number } = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
  const snakes: { [key: number]: number } = { 
    17: 7, 35: 5, 48: 26, 54: 34, 62: 19, 75: 53, 87: 24, 93: 73, 99: 78 
  };

  const questionCells: { [cellNum: number]: Question } = {};
  if (questions.length > 0) {
    const step = Math.floor(90 / questions.length) || 1;
    questions.forEach((q, index) => {
      let cellTarget = 2 + index * step;
      if (cellTarget >= 100) cellTarget = 95 - (index % 10);
      questionCells[cellTarget] = q;
    });
  }

  const boardCells = Array.from({ length: 100 }, (_, i) => 100 - i);
  const currentPlayer = players[currentTurnIndex];

  const rollDice = () => {
    if (activeQuestion || winner) return;

    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceResult(roll);

    let nextPos = currentPlayer.position + roll;
    if (nextPos >= 100) {
      nextPos = 100;
      setWinner(currentPlayer);
      setMessage(`🏆 ${currentPlayer.name} reached tile 100 and wins the game!`);
    }

    updatePlayerPosition(currentPlayer.id, nextPos);

    if (nextPos === 100) return;

    if (ladders[nextPos]) {
      setMessage(`${currentPlayer.name} landed on a Ladder at ${nextPos}! Answer correctly to climb.`);
      triggerChallenge(nextPos);
    } else if (snakes[nextPos]) {
      setMessage(`${currentPlayer.name} hit a Snake head at ${nextPos}! Answer correctly or stay stuck.`);
      triggerChallenge(nextPos);
    } else if (questionCells[nextPos]) {
      setMessage(`${currentPlayer.name} landed on a Challenge Tile at ${nextPos}!`);
      setActiveQuestion(questionCells[nextPos]);
    } else {
      setMessage(`${currentPlayer.name} rolled a ${roll} and moved to ${nextPos}.`);
      nextTurn();
    }
  };

  const updatePlayerPosition = (playerId: number, newPos: number) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, position: newPos } : p))
    );
  };

  const triggerChallenge = (pos: number) => {
    if (questionCells[pos]) {
      setActiveQuestion(questionCells[pos]);
    } else if (questions.length > 0) {
      const randomIndex = Math.floor(Math.random() * questions.length);
      setActiveQuestion(questions[randomIndex]);
    } else {
      nextTurn();
    }
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion || selectedOption === null) return;

    const isCorrect = selectedOption === activeQuestion.correctAnswer;
    const pos = currentPlayer.position;

    if (isCorrect) {
      if (ladders[pos]) {
        const climbTo = ladders[pos];
        if (climbTo >= 100) {
          updatePlayerPosition(currentPlayer.id, 100);
          setWinner(currentPlayer);
          setMessage(`Correct! 🎉 ${currentPlayer.name} climbs the ladder to 100 and WINS!`);
          setActiveQuestion(null);
          setSelectedOption(null);
          return;
        }
        updatePlayerPosition(currentPlayer.id, climbTo);
        setMessage(`Correct! 🎉 ${currentPlayer.name} climbs up the ladder to ${climbTo}!`);
      } else {
        setMessage(`Correct! 🎉 ${currentPlayer.name} answered correctly and stays at ${pos}!`);
      }
    } else {
      setMessage(`Incorrect! ❌ ${currentPlayer.name} failed and is stuck at tile ${pos}.`);
    }

    setActiveQuestion(null);
    setSelectedOption(null);
    nextTurn();
  };

  const nextTurn = () => {
    setTimeout(() => {
      setCurrentTurnIndex((prev) => {
        const nextIdx = (prev + 1) % players.length;
        setMessage(`${players[nextIdx].name}'s turn. Roll the dice!`);
        return nextIdx;
      });
      setDiceResult(null);
    }, 1500);
  };

  const resetGameStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('snake_players');
      localStorage.removeItem('snake_turn');
      localStorage.removeItem('snake_dice');
      localStorage.removeItem('snake_message');
      localStorage.removeItem('snake_active_question');
      localStorage.removeItem('snake_winner');
    }
    onBackToSetup();
  };

  return (
    <div className="w-full max-w-5xl flex flex-col items-center gap-6">
      <div className="flex justify-between w-full items-center">
        <button
          onClick={resetGameStorage}
          className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          ← Return to GM Setup
        </button>
        <h2 className="text-xl font-bold">🐍 Board Game (Victory Check Active)</h2>
        <span className="text-sm font-semibold px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full">
          {winner ? '🏆 Game Over' : `Turn: ${currentPlayer.name}`}
        </span>
      </div>

      {winner && (
        <div className="w-full bg-amber-500 text-black p-4 rounded-2xl text-center font-bold text-lg shadow-lg animate-bounce flex items-center justify-center gap-3">
          <span>🎉 CONGRATULATIONS {winner.name.toUpperCase()}! YOU REACHED TILE 100 AND WON THE GAME! 🏆</span>
          <button 
            onClick={resetGameStorage}
            className="ml-4 px-3 py-1 bg-black text-white text-xs rounded-lg hover:bg-zinc-800 cursor-pointer"
          >
            Play Again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Board Grid */}
        <div className="md:col-span-2 grid grid-cols-10 gap-1 bg-zinc-200 dark:bg-zinc-800 p-3 rounded-2xl aspect-square shadow-inner relative">
          {boardCells.map((cellNum) => {
            const playersHere = players.filter((p) => p.position === cellNum);
            const isLadder = ladders[cellNum];
            const isSnake = snakes[cellNum];
            const hasQuestion = questionCells[cellNum];

            return (
              <div
                key={cellNum}
                className={`flex flex-col items-center justify-center text-xs font-bold rounded-md relative transition-all ${
                  isLadder
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                    : isSnake
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-500/30'
                    : hasQuestion
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-400/30'
                    : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
                title={hasQuestion ? `Question: ${hasQuestion.question}` : undefined}
              >
                <span className="absolute top-1 left-1 text-[9px] opacity-60">{cellNum}</span>
                {isLadder && <span className="text-[10px]">🪜</span>}
                {isSnake && <span className="text-[10px]">🐍</span>}
                {hasQuestion && !isLadder && !isSnake && <span className="text-[10px]">❓</span>}

                <div className="flex flex-wrap gap-0.5 items-center justify-center mt-3">
                  {playersHere.map((p) => (
                    <span
                      key={p.id}
                      className={`w-3 h-3 rounded-full ${p.color} border border-white text-[8px] flex items-center justify-center text-white font-mono shadow-sm`}
                      title={p.name}
                    >
                      {p.id}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Control Panel */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full ${currentPlayer.color}`}></span>
              <h3 className="font-semibold text-lg">{currentPlayer.name}</h3>
            </div>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 min-h-[40px]">{message}</p>

            {!activeQuestion && !winner && (
              <div className="flex flex-col items-center gap-4 py-6 border-t border-b border-zinc-100 dark:border-zinc-800">
                <div className="text-4xl font-mono font-bold text-blue-600">
                  {diceResult !== null ? diceResult : '🎲'}
                </div>
                <button
                  onClick={rollDice}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Roll Dice 🎲
                </button>
              </div>
            )}

            {activeQuestion && !winner && (
              <form onSubmit={handleAnswerSubmit} className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  ⚠️ {currentPlayer.name}&apos;s Challenge
                </span>
                <p className="font-medium text-sm my-2">{activeQuestion.question}</p>
                
                <div className="flex flex-col gap-2 mb-3">
                  {activeQuestion.options.map((opt, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      className={`p-2 text-left text-xs rounded-lg border transition-colors cursor-pointer ${
                        selectedOption === idx 
                          ? 'bg-amber-600 text-white border-amber-600' 
                          : 'bg-white dark:bg-zinc-800 border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span> {opt}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={selectedOption === null}
                  className={`w-full py-2 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedOption !== null ? 'bg-amber-600 hover:bg-amber-700' : 'bg-zinc-400 cursor-not-allowed'
                  }`}
                >
                  Submit Answer
                </button>
              </form>
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Player Standings</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {players.map((p) => (
                <div key={p.id} className={`flex items-center gap-2 p-1.5 rounded-md ${p.id === currentPlayer.id && !winner ? 'bg-zinc-100 dark:bg-zinc-800 font-bold' : ''}`}>
                  <span className={`w-2 h-2 rounded-full ${p.color}`}></span>
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto font-mono text-zinc-500">Pos {p.position}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}