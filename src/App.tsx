import { useState, type SubmitEvent } from 'react';
import './App.css';

// --- コンポーネントの外側に変換関数を定義 ---
// カタカナの文字コードをスライドさせてひらがなに変換する関数
const convertToHiragana = (str: string): string => {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
};

export default function App() {
  // --- 1. State（状態）の定義とTypeScriptの型定義 ---
  
  // 直前の単語を保存するState（初期値は「しりとり」）
  const [currentWord, setCurrentWord] = useState<string>("しりとり");

  // 入力フォームの文字をリアルタイムに保存するState
  const [inputWord, setInputWord] = useState<string>("");

  // 過去に入力した単語を記録する配列のState（重複チェックに連動）
  const [history, setHistory] = useState<string[]>(["しりとり"]);

  // エラーメッセージを保存するState
  const [error, setError] = useState<string>("");

  // ゲームが終了したかどうかを判定するState
  const [isGameOver, setIsGameOver] = useState<boolean>(false);


  // --- 2. しりとりの判定ロジック（関数） ---
  
  // 送信ボタンが押されたときに実行される関数（React 19最新のSubmitEvent型）
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault(); // ページが勝手にリロードされるのを防ぐ

    // 入力が空っぽの場合は何もしない
    if (!inputWord.trim()) return;

    // 既にゲームオーバーなら処理しない
    if (isGameOver) return;

    // 【追加機能①】入力された文字（カタカナ）をひらがなに自動変換！
    // これ以降のチェックは、すべて元の inputWord ではなく processedWord を使います
    const processedWord = convertToHiragana(inputWord.trim());

    // 【追加機能②】ひらがな（カタカナから変換されたもの含む）以外の文字（漢字や英語）を弾く
    // 「^[ぁ-んー]+$」は、最初から最後までひらがなと長音(ー)だけかチェックする正規表現です
    if (!/^[ぁ-んー]+$/.test(processedWord)) {
      setError("ひらがな、またはカタカナのみで入力してください！");
      return;
    }

    // 【チェック①】過去に使用した単語の重複チェック
    if (history.includes(processedWord)) {
      setError(`「${processedWord}」はすでに使われています！`);
      setIsGameOver(true);
      return;
    }

    // 【チェック②】しりとりが繋がっているかのチェック
    const lastChar = currentWord.slice(-1);
    const firstChar = processedWord.charAt(0);

    if (lastChar !== firstChar) {
      setError(`繋がりません！「${lastChar}」から始まる単語を入力してください。`);
      return;
    }

    // 【チェック③】末尾が「ん」で終わるかのチェック
    if (processedWord.endsWith("ん")) {
      setCurrentWord(processedWord); // 「ん」がついた単語を表示して終了
      setError("「ん」がついたのでゲーム終了です！");
      setIsGameOver(true);
      return;
    }

    // --- すべてのチェックをクリアした場合（単語の更新） ---
    setCurrentWord(processedWord);              // 直前の単語を更新
    setHistory([...history, processedWord]);    // 履歴配列の末尾に新しい単語を追加
    setInputWord("");                       // 入力欄を空っぽにする
    setError("");                           // エラーを消す
  };

  // --- 3. 最初からやり直すリセット機能 ---
  const handleReset = () => {
    setCurrentWord("しりとり");
    setInputWord("");
    setHistory(["しりとり"]);
    setError("");
    setIsGameOver(false);
  };


  // --- 4. 画面の見た目（JSX） ---
  return (
    <div style={{ padding: "30px", maxWidth: "400px", margin: "0 auto" }}>
      <h1>しりとりアプリ</h1>

      {/* 直前の単語の表示 */}
      <div style={{ background: "#f0f0f0", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <p style={{ margin: 0, color: "#666" }}>直前の単語</p>
        <h2 style={{ margin: "5px 0 0 0", color: "#333" }}>{currentWord}</h2>
      </div>

      {/* エラーメッセージの表示（エラーがある時だけ赤い文字で出す） */}
      {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

      {/* ゲーム進行中か、ゲームオーバーかで画面を切り替える（条件分岐） */}
      {isGameOver ? (
        <div style={{ textAlign: "center", padding: "20px", background: "#fee2e2", borderRadius: "8px" }}>
          <h3 style={{ color: "#991b1b", margin: "0 0 10px 0" }}>GAME OVER</h3>
          <button onClick={handleReset} style={{ padding: "10px 20px", cursor: "pointer" }}>
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
          <button type="submit" style={{ padding: "10px 20px", cursor: "pointer" }}>
            送信
          </button>
        </form>
      )}

      {/* ゲーム中いつでもリセットできるボタン */}
      {!isGameOver && (
        <button onClick={handleReset} style={{ marginTop: "20px", padding: "5px 10px", cursor: "pointer", background: "none", border: "1px solid #ccc" }}>
          途中でリセット
        </button>
      )}
    </div>
  );
}