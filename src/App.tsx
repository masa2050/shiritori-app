import { useState } from 'react';
import './App.css';

export default function App() {
  // --- 1. State（状態）の定義とTypeScriptの型定義 ---
  
  // 直前の単語を保存するState（初期値は「しりとり」）
  // <string> は「この変数には文字しか入れないよ」というTSのルール
  const [currentWord, setCurrentWord] = useState<string>("しりとり");

  // 入力フォームの文字をリアルタイムに保存するState
  const [inputWord, setInputWord] = useState<string>("");

  // 過去に入力した単語を記録する配列のState（重複チェックに連動）
  // <string[]> は「文字列が入ったリスト（配列）だよ」という意味
  const [history, setHistory] = useState<string[]>(["しりとり"]);

  // エラーメッセージを保存するState
  const [error, setError] = useState<string>("");

  // ゲームが終了したかどうかを判定するState
  // <boolean> は「true（はい）か false（いいえ）のどちらかしか入らないよ」という意味
  const [isGameOver, setIsGameOver] = useState<boolean>(false);


  // --- 2. しりとりの判定ロジック（関数） ---
  
  // 送信ボタンが押されたときに実行される関数
  // e: React.FormEvent は「フォームの送信イベントだよ」というTSの型
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // ページが勝手にリロードされるのを防ぐ

    // 入力が空っぽの場合は何もしない
    if (!inputWord.trim()) return;

    // 既にゲームオーバーなら処理しない
    if (isGameOver) return;

    // 【チェック①】過去に使用した単語の重複チェック
    // historyという配列の中に、いま入力された単語が含まれているか（includes）
    if (history.includes(inputWord)) {
      setError(`「${inputWord}」はすでに使われています！`);
      setIsGameOver(true);
      return;
    }

    // 【チェック②】しりとりが繋がっているかのチェック
    // 直前単語の最後の文字（slice(-1)）と、入力単語の最初の文字（charAt(0)）を比較
    const lastChar = currentWord.slice(-1);
    const firstChar = inputWord.charAt(0);

    if (lastChar !== firstChar) {
      setError(`繋がりません！「${lastChar}」から始まる単語を入力してください。`);
      return;
    }

    // 【チェック③】末尾が「ん」で終わるかのチェック
    // 入力された単語の最後が「ん」で終わっているか（endsWith）
    if (inputWord.endsWith("ん")) {
      setCurrentWord(inputWord); // 「ん」がついた単語を表示して終了
      setError("「ん」がついたのでゲーム終了です！");
      setIsGameOver(true);
      return;
    }

    // --- すべてのチェックをクリアした場合（単語の更新） ---
    setCurrentWord(inputWord);              // 直前の単語を更新
    setHistory([...history, inputWord]);    // 履歴配列の末尾に新しい単語を追加
    setInputWord("");                       // 入力欄を空っぽにする
    setError("");                           // エラーを消す
  };

  // --- 3. 最初からやり直せるリセット機能 ---
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