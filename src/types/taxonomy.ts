export interface TaxonNode {
  name: string; // 分類名（日本語表示名、例: "脊索動物門", "鳥綱"）
  rank: string; // 階級（例: "phylum", "class"）
  count: number; // この分類に属する種の数
  children: TaxonNode[];
  speciesIds: number[]; // この分類に属する種のID
  icon?: string; // 絵文字アイコン（phylum レベルのみ）
}

export interface TaxonSelection {
  [taxonKey: string]: boolean; // key: "phylum:脊索動物門", "class:鳥綱" など
}
