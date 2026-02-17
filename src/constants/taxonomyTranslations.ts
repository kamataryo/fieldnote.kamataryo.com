/**
 * 分類群の日本語名マッピング
 */

// 門（Phylum）の日本語名
export const PHYLUM_TRANSLATIONS: Record<string, string> = {
  // 動物
  Chordata: '脊索動物門',
  Arthropoda: '節足動物門',
  Mollusca: '軟体動物門',
  Cnidaria: '刺胞動物門',
  Echinodermata: '棘皮動物門',
  Annelida: '環形動物門',
  Platyhelminthes: '扁形動物門',
  Nematoda: '線形動物門',
  Porifera: '海綿動物門',

  // 植物
  Tracheophyta: '維管束植物門',
  Bryophyta: '蘚類植物門',
  Marchantiophyta: '苔類植物門',

  // 菌類
  Basidiomycota: '担子菌門',
  Ascomycota: '子嚢菌門',
};

// 綱（Class）の日本語名
export const CLASS_TRANSLATIONS: Record<string, string> = {
  // 動物
  Mammalia: '哺乳綱',
  Aves: '鳥綱',
  Reptilia: '爬虫綱',
  Amphibia: '両生綱',
  Actinopterygii: '条鰭綱',
  Chondrichthyes: '軟骨魚綱',
  Insecta: '昆虫綱',
  Arachnida: '蜘蛛綱',
  Malacostraca: '軟甲綱',
  Gastropoda: '腹足綱',
  Bivalvia: '二枚貝綱',
  Cephalopoda: '頭足綱',

  // 植物
  Magnoliopsida: '双子葉植物綱',
  Liliopsida: '単子葉植物綱',
  Pinopsida: '球果植物綱',
  Polypodiopsida: 'シダ植物綱',
  Bryopsida: '蘚類',

  // 菌類
  Agaricomycetes: '担子菌綱',
  Ascomycetes: '子嚢菌綱',
};

// 目（Order）の日本語名
export const ORDER_TRANSLATIONS: Record<string, string> = {
  // 哺乳類
  Primates: '霊長目',
  Carnivora: '食肉目',
  Rodentia: 'げっ歯目',
  Artiodactyla: '偶蹄目',
  Chiroptera: '翼手目',
  Cetacea: '鯨目',

  // 鳥類
  Passeriformes: 'スズメ目',
  Accipitriformes: 'タカ目',
  Strigiformes: 'フクロウ目',
  Anseriformes: 'カモ目',
  Columbiformes: 'ハト目',
  Galliformes: 'キジ目',
  Charadriiformes: 'チドリ目',
  Pelecaniformes: 'ペリカン目',
  Piciformes: 'キツツキ目',

  // 爬虫類
  Squamata: '有鱗目',
  Testudines: 'カメ目',
  Crocodylia: 'ワニ目',

  // 両生類
  Anura: '無尾目（カエル）',
  Caudata: '有尾目（イモリ・サンショウウオ）',

  // 魚類
  Perciformes: 'スズキ目',
  Cypriniformes: 'コイ目',
  Siluriformes: 'ナマズ目',
  Salmoniformes: 'サケ目',
  Tetraodontiformes: 'フグ目',
  Scorpaeniformes: 'カサゴ目',

  // 昆虫
  Coleoptera: '甲虫目（コウチュウ）',
  Lepidoptera: '鱗翅目（チョウ・ガ）',
  Hymenoptera: '膜翅目（ハチ・アリ）',
  Diptera: '双翅目（ハエ・カ）',
  Hemiptera: '半翅目（カメムシ）',
  Odonata: '蜻蛉目（トンボ）',
  Orthoptera: '直翅目（バッタ）',
  Mantodea: '蟷螂目（カマキリ）',
  Blattodea: 'ゴキブリ目',

  // クモ・その他節足動物
  Araneae: 'クモ目',
  Decapoda: '十脚目（エビ・カニ）',

  // 軟体動物
  Stylommatophora: '柄眼目（カタツムリ）',

  // 植物
  Rosales: 'バラ目',
  Fabales: 'マメ目',
  Lamiales: 'シソ目',
  Asterales: 'キク目',
  Poales: 'イネ目',
  Asparagales: 'キジカクシ目',
  Liliales: 'ユリ目',
  Fagales: 'ブナ目',
  Sapindales: 'ムクロジ目',
  Malpighiales: 'キントラノオ目',
};

/**
 * 分類群名を日本語に変換
 */
export function translateTaxonName(scientificName: string, rank: 'phylum' | 'class' | 'order'): string {
  if (rank === 'phylum') {
    return PHYLUM_TRANSLATIONS[scientificName] || scientificName;
  } else if (rank === 'class') {
    return CLASS_TRANSLATIONS[scientificName] || scientificName;
  } else if (rank === 'order') {
    return ORDER_TRANSLATIONS[scientificName] || scientificName;
  }
  return scientificName;
}
