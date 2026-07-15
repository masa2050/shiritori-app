// src/shiritoriUtils.ts

/**
 * カタカナの文字コードをスライドさせてひらがなに変換する関数
 */
export const convertToHiragana = (str: string): string => {
    return str.replace(/[\u30a1-\u30f6]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
  };
  
  /**
   * WikipediaのAPIを使って、単語が実在するかチェックする関数
   */
  export const checkWordExists = async (word: string): Promise<boolean> => {
    try {
      const url = `https://ja.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(word)}&limit=1&format=json&origin=*`;
      
      const response = await fetch(url);
      if (!response.ok) return false;
      
      const data = await response.json();
      return data[1] && data[1].length > 0;
    } catch (error) {
      console.error("APIエラー:", error);
      return true; // エラー時はゲーム続行を優先してtrueを返す
    }
  };

/**
 * Wikipedia APIを使って、指定された文字から始まる単語の候補を難易度に応じた数だけ取得する関数
 */
export const fetchCpuWords = async (
    startChar: string, 
    difficulty: "easy" | "normal" | "hard"
  ): Promise<string[]> => {
    try {
      // 難易度に応じてWikipediaから取得する候補の数を変える（ここで難易度をコントロール！）
      let limit = 10;
      if (difficulty === "normal") limit = 30;
      if (difficulty === "hard") limit = 100;
  
      const url = `https://ja.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(startChar)}&limit=${limit}&format=json&origin=*`;
      
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json();
      const candidates: string[] = data[1] || [];
      
      // 漢字や英語などが混ざっていることがあるため、ひらがな・カタカナ・長音だけで構成されている単語のみを抽出
      const validWords = candidates.filter(word => /^[ぁ-んァ-ンー]+$/.test(word));
      
      return validWords;
    } catch (error) {
      console.error("CPU単語取得エラー:", error);
      return [];
    }
  };