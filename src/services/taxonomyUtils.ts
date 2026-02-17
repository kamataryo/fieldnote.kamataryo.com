import type { Species } from '@types/species';
import type { TaxonNode } from '@types/taxonomy';
import { translateTaxonName } from '@constants/taxonomyTranslations';

/**
 * 生物リストから分類群のツリー構造を生成（門→綱レベル）
 */
export function buildTaxonomyTree(species: Species[]): TaxonNode[] {
  const phylumMap = new Map<string, {
    name: string;
    displayName: string;
    classes: Map<string, {
      name: string;
      displayName: string;
      speciesIds: number[];
    }>;
    speciesIds: number[];
  }>();

  // 種ごとに分類情報を集約
  species.forEach((s) => {
    const phylumName = s.taxonomy?.phylum || '不明な門';
    const className = s.taxonomy?.class || '不明な綱';

    // 日本語名を取得
    const phylumDisplayName = translateTaxonName(phylumName, 'phylum');
    const classDisplayName = translateTaxonName(className, 'class');

    if (!phylumMap.has(phylumName)) {
      phylumMap.set(phylumName, {
        name: phylumName,
        displayName: phylumDisplayName,
        classes: new Map(),
        speciesIds: [],
      });
    }

    const phylumData = phylumMap.get(phylumName)!;
    phylumData.speciesIds.push(s.id);

    if (!phylumData.classes.has(className)) {
      phylumData.classes.set(className, {
        name: className,
        displayName: classDisplayName,
        speciesIds: [],
      });
    }

    phylumData.classes.get(className)!.speciesIds.push(s.id);
  });

  // TaxonNodeに変換（門でソート）
  const tree: TaxonNode[] = [];

  // 門をアルファベット順にソート
  const sortedPhyla = Array.from(phylumMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  sortedPhyla.forEach(([phylumName, phylumData]) => {
    // 綱を日本語名でソート
    const sortedClasses = Array.from(phylumData.classes.entries()).sort((a, b) =>
      a[1].displayName.localeCompare(b[1].displayName, 'ja')
    );

    const classNodes: TaxonNode[] = sortedClasses.map(([className, classData]) => ({
      name: classData.displayName, // 日本語名を使用
      rank: 'class',
      count: classData.speciesIds.length,
      children: [],
      speciesIds: classData.speciesIds,
    }));

    tree.push({
      name: phylumData.displayName, // 日本語名を使用
      rank: 'phylum',
      count: phylumData.speciesIds.length,
      children: classNodes,
      speciesIds: phylumData.speciesIds,
    });
  });

  return tree;
}

/**
 * 選択された分類群に属する種のIDを取得
 */
export function getSelectedSpeciesIds(
  tree: TaxonNode[],
  selection: Record<string, boolean>
): Set<number> {
  const selectedIds = new Set<number>();

  function traverse(node: TaxonNode) {
    const key = `${node.rank}:${node.name}`;
    const isSelected = selection[key];

    if (isSelected) {
      // この分類が選択されている場合、すべての種を追加
      node.speciesIds.forEach((id) => selectedIds.add(id));
      return; // 子要素を見る必要はない（親が選択されている）
    }

    // 子要素を再帰的にチェック
    node.children.forEach((child) => traverse(child));
  }

  tree.forEach((node) => traverse(node));

  return selectedIds;
}
