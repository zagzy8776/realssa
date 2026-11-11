import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trophy, Flame, ChevronRight, Star } from "lucide-react";

/**
 * Daily Sports Challenge — a lightweight quiz-style engagement widget.
 * One question per day (deterministic by date seed), 4 options, instant
 * feedback, streak tracking in localStorage. Drives daily return visits.
 */

interface ChallengeQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  fact: string;
}

const QUESTIONS: ChallengeQuestion[] = [
  {
    q: "Which African country has won the most Africa Cup of Nations titles?",
    options: ["Egypt", "Cameroon", "Ghana", "Nigeria"],
    answer: 0,
    fact: "Egypt hold the record with 7 AFCON titles, including 4 in a row from 1957–1962."
  },
  {
    q: "How many players are on the field for one team in a standard football match?",
    options: ["10", "11", "12", "9"],
    answer: 1,
    fact: "11 players per side — 10 outfield players plus the goalkeeper."
  },
  {
    q: "Which country hosted the 2023 Africa Cup of Nations?",
    options: ["Morocco", "Senegal", "South Africa", "Egypt"],
    answer: 1,
    fact: "Senegal hosted AFCON 2021 (played in 2022) and won the tournament at home."
  },
  {
    q: "What does 'VAR' stand for in football?",
    options: [
      "Video Assistant Referee",
      "Video Analysis Review",
      "Virtual Assistant Referee",
      "Video Arbitration Rule"
    ],
    answer: 0,
    fact: "VAR reviews goals, penalties, red cards and misidentified players."
  },
  {
    q: "Which Nigerian striker is nicknamed 'The Super Eagle'?",
    options: ["Victor Osimhen", "Ahmed Musa", "Wilfred Ndidi", "Samuel Chukwueze"],
    answer: 0,
    fact: "Osimhen led Nigeria to the AFCON 2023 final and won the Golden Boot."
  },
  {
    q: "How long is a standard professional football match (excluding stoppage time)?",
    options: ["80 minutes", "90 minutes", "100 minutes", "120 minutes"],
    answer: 1,
    fact: "Two halves of 45 minutes each, plus stoppage time added by the referee."
  },
  {
    q: "Which league is the Premier League part of?",
    options: ["England", "Spain", "Germany", "Italy"],
    answer: 0,
    fact: "The English Premier League is the world's most-watched domestic football league."
  },
  {
    q: "Which Ghanaian legend is known as 'The King'?",
    options: ["Michael Essien", "Asamoah Gyan", "André Ayew", "John Mensah"],
    answer: 1,
    fact: "Asamoah Gyan scored the famous 'Gyan's Goal' in the 2010 World Cup."
  },
  {
    q: "In which year was the first FIFA World Cup held?",
    options: ["1928", "1930", "1934", "1950"],
    answer: 1,
    fact: "Uruguay hosted and won the first World Cup in 1930."
  },
  {
    q: "Which South African club is nicknamed 'The Buccaneers'?",
    options: ["Mamelodi Sundowns", "Kaizer Chiefs", "Orlando Pirates", "Ajax Cape Town"],
    answer: 2,
    fact: "Orlando Pirates are one of Africa's most decorated clubs with 9 league titles."
  },
  {
    q: "What color card does a referee show for a serious foul?",
    options: ["Yellow", "Blue", "Red", "Green"],
    answer: 2,
    fact: "A red card means the player is sent off and their team plays with one fewer."
  },
  {
    q: "Which Kenyan runner is famous for marathon world records?",
    options: ["Eliud Kipchoge", "David Rudisha", "Kenenisa Bekele", "Haile Gebrselassie"],
    answer: 0,
    fact: "Kipchoge broke the 2-hour marathon barrier in the 2019 INEOS 1:59 Challenge."
  }
];

const STREAK_KEY = "realssa_sports_streak_v1";
const ANSWERED_KEY = "realssa_sports_answered_v1";

const getDayIndex = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000) % QUESTIONS.length;
};

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const SportsChallenge = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [answeredToday, setAnsweredToday] = useState(false);

  const question = QUESTIONS[getDayIndex()];
  const todayKey = getTodayKey();

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STREAK_KEY) || "0");
      setStreak(typeof s === "number" ? s : 0);
      const a = JSON.parse(localStorage.getItem(ANSWERED_KEY) || "null");
      setAnsweredToday(a === todayKey);
    } catch {
      /* ignore */
    }
  }, [todayKey]);

  const handlePick = useCallback((idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === question.answer) {
      try {
        const s = JSON.parse(localStorage.getItem(STREAK_KEY) || "0");
        const newStreak = (typeof s === "number" ? s : 0) + 1;
        localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
        localStorage.setItem(ANSWERED_KEY, JSON.stringify(todayKey));
        setStreak(newStreak);
        setAnsweredToday(true);
      } catch {
        /* ignore */
      }
    }
  }, [selected, question.answer, todayKey]);

  const correct = selected !== null && selected === question.answer;

  return (
    <section className="px-3 sm:px-4 py-5 max-w-screen-xl mx-auto">
      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          background: "linear-gradient(135deg, rgba(22,101,52,0.18) 0%, rgba(10,10,15,0.9) 60%)",
          borderColor: "rgba(34,197,94,0.25)",
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: "#22C55E" }} />
            <h2 className="text-base sm:text-lg font-black text-white">Daily Sports Challenge</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
            >
              <Flame className="w-3.5 h-3.5" /> {streak} day streak
            </span>
            <Link
              to="/sports"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              All sports <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4">
          <p className="text-sm sm:text-base font-semibold text-white mb-3 leading-snug">
            {question.q}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {question.options.map((opt, idx) => {
              let style: React.CSSProperties = {
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "#fff",
              };
              if (selected !== null) {
                if (idx === question.answer) {
                  style = { background: "rgba(34,197,94,0.2)", borderColor: "rgba(34,197,94,0.6)", color: "#4ADE80" };
                } else if (idx === selected) {
                  style = { background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.6)", color: "#F87171" };
                }
              }
              return (
                <button
                  key={idx}
                  onClick={() => handlePick(idx)}
                  disabled={selected !== null}
                  className="text-left text-sm font-semibold px-3.5 py-2.5 rounded-xl border transition-all duration-150 disabled:cursor-default hover:scale-[1.01] active:scale-[0.99]"
                  style={style}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div
              className="mt-3 flex items-start gap-2 text-xs sm:text-sm rounded-xl px-3 py-2.5"
              style={{
                background: correct ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                color: correct ? "#4ADE80" : "#F59E0B",
              }}
            >
              <Star className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {correct ? "Correct! " : "Not quite. "}
                <span style={{ color: "rgba(255,255,255,0.75)" }}>{question.fact}</span>
              </span>
            </div>
          )}

          {answeredToday && (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
              ✓ Completed today — come back tomorrow for a new question.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default SportsChallenge;
