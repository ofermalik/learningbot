/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Terminal, ShieldCheck, ChevronRight, Award, Loader2, Sparkles, BookOpen, Brain, Lightbulb, Target, Volume2, Heart, Timer, AlertCircle, CheckCircle2, XCircle, Square, RotateCcw } from 'lucide-react';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Slide {
  id: number;
  title: string;
  text: string;
  iconName: string;
  imageKeyword: string;
}

interface Question {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface GameData {
  missionTitle: string;
  briefing: string;
  slides: Slide[];
  quiz: Question[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Lock: <Lock className="text-blue-500" />,
  Terminal: <Terminal className="text-indigo-500" />,
  ShieldCheck: <ShieldCheck className="text-emerald-500" />,
  BookOpen: <BookOpen className="text-orange-500" />,
  Brain: <Brain className="text-purple-500" />,
  Sparkles: <Sparkles className="text-amber-500" />,
  Lightbulb: <Lightbulb className="text-yellow-500" />,
  Target: <Target className="text-red-500" />,
};

export default function App() {
  const [gameState, setGameState] = useState('setup'); // setup, loading, intro, learning, quiz, feedback, result
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('בינוני');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(30);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speak = async (text: string) => {
    try {
      stopSpeaking();
      setIsSpeaking(true);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `קרא בקול ברור ונעים לילדים: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is a good neutral voice
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioSrc = `data:audio/mp3;base64,${base64Audio}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS failed:", error);
      setIsSpeaking(false);
    }
  };

  const restartGame = () => {
    stopSpeaking();
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('setup');
    setTopic('');
    setGameData(null);
    setCurrentSlide(0);
    setCurrentQuestion(0);
    setScore(0);
    setLives(3);
    setTimeLeft(30);
    setLastAnswerCorrect(null);
  };

  const generateImage = async (prompt: string, index: number) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: `A high-quality, educational, child-friendly illustration of: ${prompt}. Style: clean, modern, 3D render or professional digital art.` }] }],
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setSlideImages(prev => {
            const newImages = [...prev];
            newImages[index] = imageUrl;
            return newImages;
          });
          return;
        }
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      // Fallback to picsum if generation fails
      setSlideImages(prev => {
        const newImages = [...prev];
        newImages[index] = `https://picsum.photos/seed/${prompt}/800/1000`;
        return newImages;
      });
    }
  };

  const generateContent = async () => {
    if (!topic) return;
    setGameState('loading');
    setSlideImages([]);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `צור משחק לימודי לילדים ובני נוער בגילאי 10-14 בנושא: ${topic}. 
        רמת קושי מבוקשת: ${difficulty}.
        החזר JSON במבנה הבא:
        {
          "missionTitle": "כותרת קצרה ומגניבה למשימה",
          "briefing": "תדריך קצר (עד 150 תווים) לסוכן הצעיר",
          "slides": [
            { 
              "id": 0, 
              "title": "כותרת שקף", 
              "text": "תוכן לימודי מפורט (לפחות 3-4 משפטים הכוללים עובדות מעניינות וידע מעמיק)", 
              "iconName": "אחד מ: Lock, Terminal, ShieldCheck, BookOpen, Brain, Sparkles, Lightbulb, Target",
              "imageKeyword": "תיאור קצר באנגלית עבור מחולל תמונות (למשל: A futuristic robot in a space lab)"
            }
          ],
          "quiz": [
            { 
              "q": "שאלה מאתגרת המתאימה לגילאי 10-14 ברמת ${difficulty}", 
              "options": ["אופציה 1", "אופציה 2", "אופציה 3", "אופציה 4"], 
              "correct": 0,
              "explanation": "הסבר קצר ומעניין למה התשובה הנכונה היא הנכונה"
            }
          ]
        }
        דרישות:
        - השתמש בכלי החיפוש של גוגל כדי להביא עובדות מעודכנות ומרתקות.
        - 5 שקפי למידה עשירים בידע.
        - 10 שאלות אמריקאיות ברמה גבוהה.
        - הכל בעברית תקנית.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              missionTitle: { type: Type.STRING },
              briefing: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    text: { type: Type.STRING },
                    iconName: { type: Type.STRING },
                    imageKeyword: { type: Type.STRING }
                  },
                  required: ["id", "title", "text", "iconName", "imageKeyword"]
                }
              },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    q: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correct: { type: Type.NUMBER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["q", "options", "correct", "explanation"]
                }
              }
            },
            required: ["missionTitle", "briefing", "slides", "quiz"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setGameData(data);
      
      // Start generating images for slides
      data.slides.forEach((slide: Slide, index: number) => {
        generateImage(slide.imageKeyword, index);
      });

      setGameState('intro');
    } catch (error) {
      console.error("Error generating content:", error);
      alert("אופס! קרתה שגיאה ביצירת התוכן. נסה שוב.");
      setGameState('setup');
    }
  };

  useEffect(() => {
    if (gameState === 'intro' && gameData) {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(gameData.briefing.slice(0, i));
        i++;
        if (i > gameData.briefing.length) clearInterval(interval);
      }, 30);
      return () => clearInterval(interval);
    }
  }, [gameState, gameData]);

  useEffect(() => {
    if (gameState === 'quiz' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState === 'quiz') {
      handleAnswer(-1); // Time out
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, timeLeft]);

  const handleAnswer = (idx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const isCorrect = idx === gameData?.quiz[currentQuestion].correct;
    setLastAnswerCorrect(isCorrect);
    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setLives(l => l - 1);
    }
    setGameState('feedback');
  };

  const nextQuestion = () => {
    if (lives <= 0 || currentQuestion >= (gameData?.quiz.length || 0) - 1) {
      setGameState('result');
    } else {
      setCurrentQuestion(c => c + 1);
      setTimeLeft(30);
      setGameState('quiz');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-900 font-sans p-4 flex flex-col items-center justify-center overflow-hidden" dir="rtl">
      
      {/* Header */}
      <div className="absolute top-6 w-full px-12 flex justify-between items-center text-[10px] font-semibold tracking-widest uppercase text-slate-400">
        <div className="flex items-center gap-4">
          <span>{gameState.toUpperCase()}</span>
          {gameState !== 'setup' && gameState !== 'loading' && (
            <button 
              onClick={restartGame}
              className="flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>התחל מחדש</span>
            </button>
          )}
          {gameState === 'quiz' && (
            <div className="flex items-center gap-1 text-red-500">
              {Array(3).fill(0).map((_, i) => (
                <Heart key={i} size={14} fill={i < lives ? "currentColor" : "none"} className={i >= lives ? "opacity-20" : ""} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {gameState === 'quiz' && (
            <div className={`flex items-center gap-1 font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
              <Timer size={14} />
              <span>00:{timeLeft.toString().padStart(2, '0')}</span>
            </div>
          )}
          <span>LAB V4.0</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* שלב 0: הגדרת נושא ורמת קושי */}
        {gameState === 'setup' && (
          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/50 border border-white"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <Sparkles size={32} className="text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">מה נלמד היום?</h1>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">נושא המשימה</label>
                <input 
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="למשל: חלל, דינוזאורים, הצפנה..."
                  className="w-full bg-slate-100/50 border-2 border-transparent focus:border-blue-500/20 focus:bg-white rounded-2xl p-5 text-lg outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">רמת קושי</label>
                <div className="grid grid-cols-3 gap-3">
                  {['קל', 'בינוני', 'קשה'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`py-3 rounded-xl font-bold transition-all ${difficulty === level ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={generateContent}
              disabled={!topic}
              className="w-full bg-slate-900 text-white rounded-2xl py-5 font-bold text-lg mt-10 hover:bg-blue-600 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10"
            >
              צור משימה
            </button>
          </motion.div>
        )}

        {/* שלב טעינה */}
        {gameState === 'loading' && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="relative w-24 h-24 mx-auto mb-8">
              <Loader2 size={96} className="animate-spin text-blue-500 opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-blue-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">מייצר משימה מותאמת אישית...</h2>
            <p className="text-slate-400 mt-3">הבינה המלאכותית בודקת עובדות בגוגל ובונה את השקפים</p>
          </motion.div>
        )}

        {/* שלב 1: תדריך (Intro) */}
        {gameState === 'intro' && gameData && (
          <motion.div 
            key="intro"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -40 }}
            className="max-w-xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/50 border border-white"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <Terminal size={32} className="text-indigo-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{gameData.missionTitle}</h1>
            </div>
            <div className="bg-slate-50 rounded-3xl p-8 mb-10 min-h-[140px] relative">
              <button 
                onClick={() => isSpeaking ? stopSpeaking() : speak(gameData.briefing)} 
                className={`absolute top-4 left-4 p-2 rounded-xl transition-all ${isSpeaking ? 'bg-red-50 text-red-500' : 'text-slate-300 hover:text-blue-500'}`}
              >
                {isSpeaking ? <Square size={20} fill="currentColor" /> : <Volume2 size={20} />}
              </button>
              <p className="text-xl leading-relaxed text-slate-700 font-medium">{displayText}<span className="animate-pulse text-blue-500">|</span></p>
            </div>
            <button 
              onClick={() => setGameState('learning')}
              className="w-full bg-blue-600 text-white rounded-2xl py-5 font-bold text-lg hover:bg-slate-900 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              התחל למידה <ChevronRight className="rotate-180" />
            </button>
          </motion.div>
        )}

        {/* שלב 2: למידה אינטראקטיבית */}
        {gameState === 'learning' && gameData && (
          <motion.div 
            key="learning"
            initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}
            className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <div className="flex flex-col">
              <div className="mb-6 flex gap-2">
                {gameData.slides.map((_, idx) => (
                  <div key={idx} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${idx <= currentSlide ? 'bg-blue-500' : 'bg-slate-200'}`} />
                ))}
              </div>
              <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50 border border-white flex-1 flex flex-col relative">
                <button 
                  onClick={() => isSpeaking ? stopSpeaking() : speak(gameData.slides[currentSlide].text)} 
                  className={`absolute top-10 left-10 p-3 rounded-2xl transition-all ${isSpeaking ? 'bg-red-50 text-red-500' : 'text-slate-300 hover:text-blue-500'}`}
                >
                  {isSpeaking ? <Square size={24} fill="currentColor" /> : <Volume2 size={24} />}
                </button>
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    {ICON_MAP[gameData.slides[currentSlide].iconName] || <BookOpen className="text-blue-500" />}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">{gameData.slides[currentSlide].title}</h2>
                </div>
                <p className="text-lg text-slate-600 leading-relaxed mb-auto whitespace-pre-line">
                  {gameData.slides[currentSlide].text}
                </p>
                <div className="mt-10 flex gap-4">
                  <button 
                    onClick={() => {
                      if (currentSlide < gameData.slides.length - 1) setCurrentSlide(curr => curr + 1);
                      else setGameState('quiz');
                    }}
                    className="flex-1 bg-slate-900 text-white rounded-2xl py-4 font-bold hover:bg-blue-600 transition-all cursor-pointer shadow-lg shadow-slate-900/10"
                  >
                    {currentSlide === gameData.slides.length - 1 ? "עבור למבחן" : "המשך"}
                  </button>
                  {currentSlide > 0 && (
                    <button 
                      onClick={() => setCurrentSlide(curr => curr - 1)}
                      className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      חזור
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="h-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/50 border border-white relative group flex items-center justify-center">
                {slideImages[currentSlide] ? (
                  <motion.img 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={slideImages[currentSlide]} 
                    alt={gameData.slides[currentSlide].title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-300">
                    <Loader2 size={48} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">מייצר גרפיקה...</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
            </div>
          </motion.div>
        )}

        {/* שלב 3: חידון */}
        {gameState === 'quiz' && gameData && (
          <motion.div 
            key="quiz"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-12 shadow-2xl shadow-slate-200/50 border border-white"
          >
            <div className="flex justify-between items-center mb-10">
              <div className="px-4 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold tracking-wider uppercase">מבחן סופי</div>
              <div className="text-slate-400 font-bold text-sm">{currentQuestion + 1} / {gameData.quiz.length}</div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-10 leading-tight">
              {gameData.quiz[currentQuestion].q}
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {gameData.quiz[currentQuestion].options.map((opt, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className="p-6 bg-slate-50 hover:bg-blue-50 border-2 border-transparent hover:border-blue-200 rounded-2xl text-right text-lg font-medium text-slate-700 transition-all cursor-pointer flex justify-between items-center group"
                >
                  <span>{opt}</span>
                  <ChevronRight size={20} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all rotate-180" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* שלב 3.5: משוב (Feedback) */}
        {gameState === 'feedback' && gameData && (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl w-full bg-white rounded-[2.5rem] p-12 shadow-2xl border border-slate-100 text-center"
          >
            <div className={`inline-flex p-6 rounded-3xl mb-8 ${lastAnswerCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {lastAnswerCorrect ? <CheckCircle2 size={64} /> : <XCircle size={64} />}
            </div>
            <h2 className={`text-3xl font-black mb-4 ${lastAnswerCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
              {lastAnswerCorrect ? "כל הכבוד! תשובה נכונה" : "אופס, לא בדיוק..."}
            </h2>
            <div className="bg-slate-50 rounded-3xl p-8 mb-10 text-right">
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                <AlertCircle size={16} />
                הסבר לימודי
              </h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                {gameData.quiz[currentQuestion].explanation}
              </p>
            </div>
            <button 
              onClick={nextQuestion}
              className="w-full bg-slate-900 text-white rounded-2xl py-5 font-bold text-lg hover:bg-blue-600 transition-all cursor-pointer"
            >
              {currentQuestion === gameData.quiz.length - 1 || lives <= 0 ? "לתוצאות המשימה" : "לשאלה הבאה"}
            </button>
          </motion.div>
        )}

        {/* שלב 4: תוצאות */}
        {gameState === 'result' && gameData && (
          <motion.div 
            key="result"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="max-w-xl w-full bg-white/80 backdrop-blur-2xl rounded-[2.5rem] p-16 shadow-2xl shadow-slate-200/50 border border-white text-center"
          >
            <div className="inline-flex p-8 rounded-[2rem] bg-blue-50 mb-10">
              <Award size={80} className="text-blue-600" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
              {lives <= 0 ? "המשימה הופסקה" : "המשימה הושלמה!"}
            </h1>
            <div className="flex justify-center gap-8 mb-12">
              <div className="text-center">
                <div className="text-4xl font-black text-blue-600">{score}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">ציון</div>
              </div>
              <div className="w-px bg-slate-100" />
              <div className="text-center">
                <div className="text-4xl font-black text-slate-900">
                  {score >= 9 ? "רב-אמן" : score >= 7 ? "סוכן" : "טירון"}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">דירוג</div>
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white rounded-2xl py-5 font-bold text-lg hover:bg-blue-600 transition-all cursor-pointer shadow-lg shadow-slate-900/10"
            >
              נסה משימה חדשה
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
