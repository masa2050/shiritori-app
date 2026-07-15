import { useState, useEffect, useRef, type FormEvent } from "react";
// 1. インポートを完全に正しい小文字ファイル名に固定
import { convertToHiragana, checkWordExists } from "./ShiritoriUtils.ts";

export default function App() {
  // --- 1. State（状態）の定義とTypeScriptの型定義 ---

  const [currentWord, setCurrentWord] = useState<string>("しりとり");
  const [inputWord, setInputWord] = useState<string>("");
  const [history, setHistory] = useState<string[]>(["しりとり"]);
  const [error, setError] = useState<string>("");
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- タイマー用のステートと参照 ---
  const [timeLeft, setTimeLeft] = useState<number>(10); // 初期値10秒
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 【新規追加】入力欄をプログラムから直接操作するための参照（フォーカス用）
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 難易度を管理するState
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("easy");

  // タイマーを開始・リセットする関数
  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(10);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeOut = () => {
    setError("時間切れです！あなたの負けです。");
    setIsGameOver(true);
  };

  useEffect(() => {
    if (isGameOver || isLoading) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [history, isGameOver, isLoading]);

  // ロード中（相手のターン）が終わって入力欄が復活した瞬間に、自動でフォーカスを当てる
  useEffect(() => {
    if (!isLoading && !isGameOver) {
      inputRef.current?.focus();
    }
  }, [isLoading, isGameOver]);

  // --- 2. しりとりの判定ロジック（関数） ---

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!inputWord.trim()) return;
    if (isGameOver || isLoading) return;

    const processedWord = convertToHiragana(inputWord.trim());

    if (!/^[ぁ-んー]+$/.test(processedWord)) {
      setError("ひらがな、またはカタカナのみで入力してください！");
      return;
    }

    if (processedWord.length < 2) {
      setError("単語は2文字以上で入力してください！");
      return;
    }

    if (history.includes(processedWord)) {
      setError(`「${processedWord}」はすでに使われています！`);
      setIsGameOver(true);
      return;
    }

    let lastChar = currentWord.slice(-1);

    if (lastChar === "ー") {
      lastChar = currentWord.slice(-2, -1);
    }

    const smallToLarge: Record<string, string> = {
      ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お",
      っ: "つ", ゃ: "や", ゅ: "ゆ", ょ: "よ", ゎ: "わ",
    };

    if (lastChar in smallToLarge) {
      lastChar = smallToLarge[lastChar];
    }
    const firstChar = processedWord.charAt(0);

    if (lastChar !== firstChar) {
      setError(
        `繋がりません！「${lastChar}」から始まる単語を入力してください。`,
      );
      return;
    }

    setIsLoading(true);
    setError("辞書で単語を確認中...");

    const exists = await checkWordExists(processedWord);

    if (!exists) {
      setIsLoading(false);
      setError(`「${processedWord}」は辞書にない、実在しない単語です！`);
      return;
    }

    setError("");

    if (processedWord.endsWith("ん")) {
      setCurrentWord(processedWord);
      setError("「ん」がついたのでゲーム終了です！");
      setIsGameOver(true);
      setIsLoading(false);
      return;
    }

    // --- プレイヤーの単語更新 ---
    const newHistory = [...history, processedWord];
    setCurrentWord(processedWord);
    setHistory(newHistory);
    setInputWord("");

    // --- 即レスCPUの思考ロジック ---
    setIsLoading(true);

    let nextStartChar = processedWord.slice(-1);
    if (nextStartChar === "ー") {
      nextStartChar = processedWord.slice(-2, -1);
    }
    if (nextStartChar in smallToLarge) {
      nextStartChar = smallToLarge[nextStartChar];
    }

    try {
      // インポートパスも小文字の「shiritoriUtils」に固定
      const { fetchCpuWords } = await import("./ShiritoriUtils.ts");
      const candidates = await fetchCpuWords(nextStartChar, difficulty);
      
      const processedCandidates = candidates
        .map(word => convertToHiragana(word))
        .filter(word => word.length >= 2);

      const unusedCandidates = processedCandidates.filter(word => !newHistory.includes(word));

      let cpuWord = "";

      // 難易度チョイス
      // 2. 難易度（difficulty）に応じた単語チョイス
      if (difficulty === "easy") {
        const currentTurn = newHistory.length;

        // 【簡単モード】：2ターン目以降（履歴が3つ以上）、かつ30%の確率で「ん」で終わる単語を探して自爆する
        if (currentTurn >= 3 && Math.random() < 0.30) {
          // Wikipediaから取得した候補の中から、語尾が「ん」で終わるもの（実在する言葉）を探す
          const selfDestructCandidate = unusedCandidates.find(w => w.endsWith("ん"));
          if (selfDestructCandidate) {
            cpuWord = selfDestructCandidate;
          }
        }

        // 自爆しないターン、または「ん」終わりの候補が見つからなかった場合は普通の安全な言葉を選ぶ
        if (!cpuWord && unusedCandidates.length > 0) {
          const safeCandidates = unusedCandidates.filter(w => !w.endsWith("ん"));
          if (safeCandidates.length > 0) {
            cpuWord = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
          }
        }
      }
      else if (difficulty === "normal") {
        if (Math.random() < 0.10) {
          cpuWord = ""; 
        } else {
          const safeCandidates = unusedCandidates.filter(w => !w.endsWith("ん"));
          if (safeCandidates.length > 0) {
            cpuWord = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
          }
        }
      } 
      else if (difficulty === "hard") {
        const safeCandidates = unusedCandidates.filter(w => !w.endsWith("ん"));
        const annoyingCandidates = safeCandidates.filter(w => ["り", "る", "れ"].includes(w.slice(-1)));
        
        if (annoyingCandidates.length > 0) {
          cpuWord = annoyingCandidates[Math.floor(Math.random() * annoyingCandidates.length)];
        } else if (safeCandidates.length > 0) {
          cpuWord = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
        }
      }

      // CPUからの返答処理
      if (cpuWord) {
        setTimeout(() => {
          setCurrentWord(cpuWord);
          setHistory(prev => [...prev, cpuWord]);
          setIsLoading(false); // ここで自動でインプット欄へフォーカスが当たります

          if (cpuWord.endsWith("ん")) {
            setError(`CPUは「${cpuWord}」と言って自爆しました！あなたの勝ちです！`);
            setIsGameOver(true);
          }
        }, 1000);
      } else {
        setTimeout(() => {
          setError("CPUは次の単語が思い浮かびませんでした！あなたの勝ちです！");
          setIsGameOver(true);
          setIsLoading(false);
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  // 最初からやり直すリセット機能
  const handleReset = () => {
    setCurrentWord("しりとり");
    setInputWord("");
    setHistory(["しりとり"]);
    setError("");
    setIsGameOver(false);
    setIsLoading(false);
    resetTimer();
    // リセットした瞬間にフォーカスを合わせる
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // --- 4. 画面の見た目（JSX + Tailwind CSS） ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-6">
        
        {/* タイトル */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            しりとりバトル
          </h1>
          <p className="text-sm text-slate-400 mt-1">Wikipedia API搭載 CPU対戦モード</p>
        </div>

        {/* 難易度選択 */}
        {!isGameOver && (
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setDifficulty("easy")}
              disabled={isLoading}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                difficulty === "easy"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              簡単
            </button>
            <button
              onClick={() => setDifficulty("normal")}
              disabled={isLoading}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                difficulty === "normal"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              普通
            </button>
            <button
              onClick={() => setDifficulty("hard")}
              disabled={isLoading}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                difficulty === "hard"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              難しい
            </button>
          </div>
        )}

        {/* 直前の単語表示エリア */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 rounded-xl p-5 text-center relative overflow-hidden shadow-inner">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">直前の単語</p>
          <h2 className="text-4xl font-black text-slate-800 mt-2 tracking-wide font-mono">
            {currentWord}
          </h2>
        </div>

        {/* エラー・警告メッセージ */}
        {error && (
          <div className={`p-3.5 rounded-lg text-sm text-center font-medium border ${
            error.includes("確認中") 
              ? "bg-blue-50 border-blue-100 text-blue-600 animate-pulse" 
              : "bg-red-50 border-red-100 text-red-600"
          }`}>
            {error}
          </div>
        )}

        {/* タイマー表示 */}
        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-300 ${
            timeLeft <= 3 
              ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse font-extrabold scale-105" 
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${timeLeft <= 3 ? "bg-rose-400" : "bg-amber-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${timeLeft <= 3 ? "bg-rose-500" : "bg-amber-500"}`}></span>
            </span>
            残り時間: <span className="text-lg font-mono tracking-tight">{timeLeft}</span> 秒
          </div>
        </div>

        {/* アクションエリア（ゲーム中 or ゲーム終了） */}
        {isGameOver ? (
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-6 text-center space-y-4">
            <h3 className="text-xl font-black text-rose-600 tracking-wider">GAME OVER</h3>
            <button
              onClick={handleReset}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-md shadow-slate-900/10"
            >
              最初からやり直す
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputWord}
              onChange={(e) => setInputWord(e.target.value)}
              disabled={isLoading}
              placeholder={isLoading ? "相手が考えています..." : "次の単語を入力"}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-150 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl transition-all duration-150 flex items-center justify-center min-w-[90px] shadow-md shadow-indigo-600/10 disabled:shadow-none"
            >
              {isLoading ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin"></span>
                  <span>確認中</span>
                </div>
              ) : "送信"}
            </button>
          </form>
        )}

        {/* 途中リセットボタン */}
        {!isGameOver && (
          <div className="text-center">
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-4 decoration-dotted transition-colors"
            >
              途中でリセット
            </button>
          </div>
        )}

      </div>
    </div>
  );
}