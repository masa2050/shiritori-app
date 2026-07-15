import { useState, useEffect, useRef, type SubmitEvent } from "react";
// 1. インポートを完全に正しい小文字ファイル名に固定
import { convertToHiragana, checkWordExists } from "./ShiritoriUtils.ts";
import "./App.css";

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

  const handleSubmit = async (e: SubmitEvent) => {
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

  // --- 4. 画面の見た目（JSX） ---
  return (
    <div style={{ padding: "30px", maxWidth: "400px", margin: "0 auto" }}>
      <h1>しりとりアプリ</h1>

      {!isGameOver && (
        <div style={{ marginBottom: "20px", display: "flex", gap: "5px", justifyContent: "center" }}>
          <button 
            onClick={() => setDifficulty("easy")}
            disabled={isLoading}
            style={{ 
              padding: "5px 10px", 
              cursor: isLoading ? "not-allowed" : "pointer",
              background: difficulty === "easy" ? "#10b981" : "#e5e7eb",
              color: difficulty === "easy" ? "white" : "#374151",
              border: "none",
              borderRadius: "4px",
              opacity: isLoading ? 0.6 : 1
            }}
          >
            簡単
          </button>
          <button 
            onClick={() => setDifficulty("normal")}
            disabled={isLoading}
            style={{ 
              padding: "5px 10px", 
              cursor: isLoading ? "not-allowed" : "pointer",
              background: difficulty === "normal" ? "#3b82f6" : "#e5e7eb",
              color: difficulty === "normal" ? "white" : "#374151",
              border: "none",
              borderRadius: "4px",
              opacity: isLoading ? 0.6 : 1
            }}
          >
            普通
          </button>
          <button 
            onClick={() => setDifficulty("hard")}
            disabled={isLoading}
            style={{ 
              padding: "5px 10px", 
              cursor: isLoading ? "not-allowed" : "pointer",
              background: difficulty === "hard" ? "#ef4444" : "#e5e7eb",
              color: difficulty === "hard" ? "white" : "#374151",
              border: "none",
              borderRadius: "4px",
              opacity: isLoading ? 0.6 : 1
            }}
          >
            難しい
          </button>
        </div>
      )}

      <div
        style={{
          background: "#f0f0f0",
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <p style={{ margin: 0, color: "#666" }}>直前の単語</p>
        <h2 style={{ margin: "5px 0 0 0", color: "#333" }}>{currentWord}</h2>
      </div>

      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      <div className={`timer-display ${timeLeft <= 3 ? "danger" : ""}`}>
        残り時間: <span>{timeLeft}</span> 秒
      </div>

      {isGameOver ? (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            background: "#fee2e2",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "#991b1b", margin: "0 0 10px 0" }}>GAME OVER</h3>
          <button
            onClick={handleReset}
            style={{ padding: "10px 20px", cursor: "pointer" }}
          >
            最初からやり直す
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px" }}>
          <input
            ref={inputRef} // 👈 inputRefを紐付けることで、自動フォーカスが機能します
            type="text"
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? "相手が考えています..." : "次の単語を入力"}
            style={{ padding: "10px", flex: 1 }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{ padding: "10px 20px", cursor: isLoading ? "not-allowed" : "pointer" }}
          >
            {isLoading ? "確認中" : "送信"}
          </button>
        </form>
      )}

      {!isGameOver && (
        <button
          onClick={handleReset}
          style={{
            marginTop: "20px",
            padding: "5px 10px",
            cursor: "pointer",
            background: "none",
            border: "1px solid #ccc",
          }}
        >
          途中でリセット
        </button>
      )}
    </div>
  );
}