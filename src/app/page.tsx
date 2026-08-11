'use client';

import { useState } from 'react';
import GameBoard from '@/components/GameBoard';

export interface GameQuestion {
  id: number;
  topic: string;
  questionText: string;
  correctAnswer: string;
}

export default function Home() {
  const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  
  const [topic, setTopic] = useState('Interest');
  const [questionText, setQuestionText] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');

  // Handle manual question addition
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !correctAnswer.trim()) return;

    const newQuestion: GameQuestion = {
      id: Date.now() + Math.random(),
      topic,
      questionText,
      correctAnswer,
    };

    setQuestions([...questions, newQuestion]);
    setQuestionText('');
    setCorrectAnswer('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        
        if (file.name.endsWith('.json')) {
          // Parse JSON file
          const parsedData = JSON.parse(content);
          if (Array.isArray(parsedData)) {
            const formattedQuestions: GameQuestion[] = parsedData.map((q, index) => ({
              id: Date.now() + index,
              topic: q.topic || 'General',
              questionText: q.questionText || q.question || '',
              correctAnswer: String(q.correctAnswer || q.answer || ''),
            }));
            setQuestions((prev) => [...prev, ...formattedQuestions]);
          } else {
            alert('Invalid JSON format. Expected an array of questions.');
          }
        } else if (file.name.endsWith('.txt')) {
          // Parse TXT file (Format: Topic | Question | Answer)
          const lines = content.split('\n');
          const parsedQuestions: GameQuestion[] = [];

          lines.forEach((line, index) => {
            if (!line.trim()) return; // Skip empty lines
            const parts = line.split('|');
            if (parts.length >= 3) {
              parsedQuestions.push({
                id: Date.now() + index,
                topic: parts[0].trim(),
                questionText: parts[1].trim(),
                correctAnswer: parts[2].trim(),
              });
            }
          });

          if (parsedQuestions.length > 0) {
            setQuestions((prev) => [...prev, ...parsedQuestions]);
          } else {
            alert('No valid questions found. Ensure each line uses the format: Topic | Question | Answer');
          }
        }
      } catch (error) {
        alert('Failed to read file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  // Handle deleting a question from the list
  const handleDeleteQuestion = (id: number) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-6 md:p-12 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col items-center">
      {gameState === 'setup' ? (
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-center mb-2">
            🐍 Snake & Ladder: Math & Finance Edition
          </h1>
          <p className="text-center text-zinc-500 dark:text-zinc-400 mb-8">
            Game Master Setup Dashboard
          </p>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-xl font-semibold mb-4">📂 Upload Questions </h2>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-zinc-500">
                Upload a `.txt` file where each line is formatted as: <code className="text-blue-600 bg-blue-50 dark:bg-blue-950 px-1 rounded">Topic | Question | Answer</code>
              </label>
              <input
                type="file"
                accept=".json,.txt"
                onChange={handleFileUpload}
                className="w-full p-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">➕ Or Add Question Manually</h2>
            
            <form onSubmit={handleAddQuestion} className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Topic Category</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                >
                  <option value="Straight Commission">Straight Commission</option>
                  <option value="Salary-Based Commission">Salary-Based Commission</option>
                  <option value="Wage">Wage</option>
                  <option value="Salary">Salary</option>
                  <option value="Interest">Interest</option>
                  <option value="Discount">Discount</option>
                  <option value="Arithmetic Sequence">Arithmetic Sequence</option>
                  <option value="Geometric Sequence">Geometric Sequence</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Math / Financial Question</label>
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g., What is 12 raised to 2?"
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Exact Correct Answer</label>
                <input
                  type="text"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="e.g., 144"
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent"
                />
              </div>

              <button
                type="submit"
                className="mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
              >
                Add to Question Bank
              </button>
            </form>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
              <h3 className="font-medium mb-3">Registered Questions ({questions.length})</h3>
              {questions.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">No questions added yet. Upload a text file or add items manually to start!</p>
              ) : (
                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {questions.map((q) => (
                    <li key={q.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 text-sm">
                      <div>
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-md mb-1">
                          {q.topic}
                        </span>
                        <p className="font-medium">{q.questionText}</p>
                        <p className="text-xs text-zinc-500">Answer: <span className="font-mono text-emerald-600">{q.correctAnswer}</span></p>
                      </div>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-red-500 hover:text-red-700 text-sm px-2 py-1 cursor-pointer"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => setGameState('playing')}
              disabled={questions.length === 0}
              className={`w-full mt-8 py-3.5 px-4 rounded-xl font-bold transition-colors ${
                questions.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              }`}
            >
              Start Game Board 🚀
            </button>
          </div>
        </div>
      ) : (
        <GameBoard questions={questions} onBackToSetup={() => setGameState('setup')} />
      )}
    </main>
  );
}