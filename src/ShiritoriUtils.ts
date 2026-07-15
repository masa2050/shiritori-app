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