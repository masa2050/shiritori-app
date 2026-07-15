import { useState, useEffect, useRef, type SubmitEvent } from "react";
import { convertToHiragana, checkWordExists } from "./shiritoriUtils";
import "./App.css";

export default function App() {
  // --- 1. State（状態）の定義とTypeScriptの型定義 ---

  // 直前の単語を保存するState（初期値は「しりとり」）
  const [currentWord, setCurrentWord] = useState<string>("しりとり");

  // 入力フォームの文字をリアルタイムに保存するState
  const [inputWord, setInputWord] = useState<string>("");

  // 過去に入力した単語を記録する配列 of State（重複チェックに連動）
  const [history, setHistory] = useState<string[]>(["しりとり"]);

  // エラーメッセージを保存するState
  const [error, setError] = useState<string>("");

  // ゲームが終了したかどうかを判定するState
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // 【UX向上】APIの通信中にボタンを連打させないためのState
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // --- タイマー用のステートと参照 ---
  const [timeLeft, setTimeLeft] = useState<number>(10); // 初期値10秒
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // タイマーを開始・リセットする関数
  const resetTimer = () => {
    // すでに動いているタイマーがあればクリアする
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    // 残り時間を10秒に戻す
    setTimeLeft(10);

    // 1秒ごとにカウントダウンするタイマーを起動
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 0秒になったらタイマーを止めてゲームオーバーにする
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeOut(); // タイムアウト時の処理
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // タイムアウト（時間切れ）時の処理
  const handleTimeOut = () => {
    setError("時間切れです！あなたの負けです。");
    setIsGameOver(true); // 👈 これで10秒経ったら自動でゲームオーバー画面に切り替わります！
  };

  // ゲーム開始時や、単語が正しく送信されたタイミングでタイマーをリセットする
  useEffect(() => {
    // ゲームオーバー状態の時はタイマーを起動しない
    if (isGameOver) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    resetTimer();
    // クリーンアップ処理（コンポーネントが消えるときにタイマーを止める）
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [history, isGameOver]); // 履歴が更新された時、またはゲームオーバーになった時に連動

  // --- 2. しりとりの判定ロジック（関数） ---

  // 送信ボタンが押されたときに実行される関数（React 19最新のSubmitEvent型）
  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault(); // ページが勝手にリロードされるのを防ぐ

    // 入力が空っぽの場合は何もしない
    if (!inputWord.trim()) return;

    // 既にゲームオーバーなら処理しない
    if (isGameOver || isLoading) return;

    // 【追加機能①】入力された文字（カタカナ）をひらがなに自動変換！
    const processedWord = convertToHiragana(inputWord.trim());

    // 【追加機能②】ひらがな以外の文字（漢字や英語）を弾く
    if (!/^[ぁ-んー]+$/.test(processedWord)) {
      setError("ひらがな、またはカタカナのみで入力してください！");
      return;
    }

    // 【追加】1文字だけの入力を弾く（2文字以上を必須にする）
    if (processedWord.length < 2) {
      setError("単語は2文字以上で入力してください！");
      return;
    }

    // 【チェック①】過去に使用した単語の重複チェック
    if (history.includes(processedWord)) {
      setError(`「${processedWord}」はすでに使われています！`);
      setIsGameOver(true);
      return;
    }

    // 【チェック②】しりとりが繋がっているかのチェック
    let lastChar = currentWord.slice(-1);

    // ルール1: もし末尾が「ー」なら、最後から2番目の文字を取る
    if (lastChar === "ー") {
      lastChar = currentWord.slice(-2, -1);
    }

    // ルール2: もしその文字が小さい文字なら、大きい文字に変換するマッピング
    const smallToLarge: Record<string, string> = {
      ぁ: "あ",
      ぃ: "い",
      ぅ: "う",
      ぇ: "え",
      ぉ: "お",
      っ: "つ",
      ゃ: "や",
      ゅ: "ゆ",
      ょ: "よ",
      ゎ: "わ",
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

    // ※ handleSubmitの中に重複して存在していた不要な handleReset は綺麗に削除しました

    setIsLoading(true);
    setError("辞書で単語を確認中...");

    const exists = await checkWordExists(processedWord);

    setIsLoading(false); // 通信が終わったので解除
    setError("");

    if (!exists) {
      setError(`「${processedWord}」は辞書にない、実在しない単語です！`);
      return; // 履歴に追加せず、ここでストップ（やり直し可能）
    }

    // 【チェック③】末尾が「ん」で終わるかのチェック
    if (processedWord.endsWith("ん")) {
      setCurrentWord(processedWord); // 「ん」がついた単語を表示して終了
      setError("「ん」がついたのでゲーム終了です！");
      setIsGameOver(true);
      return;
    }

    // --- すべてのチェックをクリアした場合（単語の更新） ---
    setCurrentWord(processedWord); // 直前の単語を更新
    setHistory([...history, processedWord]); // 履歴配列の末尾に新しい単語を追加
    setInputWord(""); // 入力欄を空っぽにする
    setError(""); // エラーを消す
  };

  // --- 3. 最初からやり直すリセット機能 ---
  const handleReset = () => {
    setCurrentWord("しりとり");
    setInputWord("");
    setHistory(["しりとり"]);
    setError("");
    setIsGameOver(false);
    resetTimer(); // 👈 やり直した時に、タイマーも10秒から再スタートさせます！
  };

  // --- 4. 画面の見た目（JSX） ---
  return (
    <div style={{ padding: "30px", maxWidth: "400px", margin: "0 auto" }}>
      <h1>しりとりアプリ</h1>

      {/* 直前の単語の表示 */}
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

      {/* エラーメッセージの表示（エラーがある時だけ赤い文字で出す） */}
      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      {/* タイマー表示エリア */}
      <div className={`timer-display ${timeLeft <= 3 ? "danger" : ""}`}>
        残り時間: <span>{timeLeft}</span> 秒
      </div>

      {/* ゲーム進行中か、ゲームオーバーかで画面を切り替える（条件分岐） */}
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
        /* 任意の単語を入力できるフォーム */
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            placeholder="次の単語を入力"
            style={{ padding: "10px", flex: 1 }}
          />
          <button
            type="submit"
            style={{ padding: "10px 20px", cursor: "pointer" }}
          >
            送信
          </button>
        </form>
      )}

      {/* ゲーム中いつでもリセットできるボタン */}
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