// 英語の門名 → 絵文字
export const PHYLUM_ICONS: Record<string, string> = {
  Chordata: '🐠',
  Arthropoda: '🦋',
  Mollusca: '🐚',
  Cnidaria: '🪸',
  Echinodermata: '⭐',
  Annelida: '🪱',
  Platyhelminthes: '〰️',
  Nematoda: '〰️',
  Porifera: '🧽',
  Tracheophyta: '🌿',
  Bryophyta: '🌱',
  Marchantiophyta: '🍃',
  Basidiomycota: '🍄',
  Ascomycota: '🍄',
};

// 英語の門名 → 地図上のcircle色
export const PHYLUM_COLORS: Record<string, string> = {
  Chordata: '#4A90E2',     // 青
  Arthropoda: '#F5A623',   // オレンジ
  Mollusca: '#9B59B6',     // 紫
  Tracheophyta: '#27AE60', // 緑
  Basidiomycota: '#C0392B', // 赤茶
  Ascomycota: '#C0392B',
  Cnidaria: '#E91E63',     // ピンク
  Echinodermata: '#FF9800', // 橙
};

export const DEFAULT_PHYLUM_COLOR = '#3bb2d0'; // フォールバック

export function getPhylumIcon(phylumScientificName?: string): string {
  if (!phylumScientificName) return '❓';
  return PHYLUM_ICONS[phylumScientificName] ?? '❓';
}

export function getPhylumColor(phylumScientificName?: string): string {
  if (!phylumScientificName) return DEFAULT_PHYLUM_COLOR;
  return PHYLUM_COLORS[phylumScientificName] ?? DEFAULT_PHYLUM_COLOR;
}
