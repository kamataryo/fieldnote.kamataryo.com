import type { Species } from '@types/species';
import type { WikipediaSearchResult, WikipediaPage, WikipediaImageInfo } from '@types/api';
import { APIClient, RateLimiter } from './apiClient';

export class WikipediaAPI extends APIClient {
  constructor() {
    // 10回/分に制限
    super('https://ja.wikipedia.org/w/api.php', new RateLimiter(10, 60000));
  }

  /**
   * 複数種をバッチ取得でまとめてWikipedia情報を付与する（主要エントリポイント）
   *
   * - Wikipedia URL を持つ種: titles=T1|T2|... で最大20件を1リクエストで取得
   *   → その後 imageinfo も一括取得（ライセンス・著作者情報を保持）
   * - Wikipedia URL を持たない種: 5件並列チャンクで個別検索・取得
   */
  async enrichBatch(
    species: Species[],
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<Species[]> {
    const withUrl = species.filter((s) => s.wikipediaUrl);
    const withoutUrl = species.filter((s) => !s.wikipediaUrl);

    // 結果を id → Species のマップで収集し、最後に元の順序で返す
    const results = new Map<number, Species>(species.map((s) => [s.id, s]));
    let processed = 0;

    // ── 有URL種: バッチ処理（20件単位） ──────────────────────────
    const batchChunkSize = 20;
    for (let i = 0; i < withUrl.length; i += batchChunkSize) {
      const chunk = withUrl.slice(i, i + batchChunkSize);

      // タイトル → Species の対応マップを構築
      const titleToSpecies = new Map<string, Species>();
      chunk.forEach((s) => {
        const title = this.extractPageTitleFromUrl(s.wikipediaUrl!);
        if (title) titleToSpecies.set(title, s);
      });

      if (titleToSpecies.size === 0) {
        processed += chunk.length;
        continue;
      }

      // 1. ページ本文と画像ファイル名一覧を一括取得（1リクエスト/チャンク）
      const titlesParam = Array.from(titleToSpecies.keys()).join('|');
      const pageDataMap = await this.getBatchPageData(titlesParam);

      // 2. 画像ファイル名を収集してまとめて imageinfo を取得（1リクエスト/チャンク）
      const imageRequests: { speciesId: number; imageTitle: string }[] = [];
      for (const [title, pageData] of pageDataMap) {
        const s = titleToSpecies.get(title);
        if (s && pageData.images.length > 0) {
          imageRequests.push({ speciesId: s.id, imageTitle: pageData.images[0].title });
        }
      }
      const imageInfoMap =
        imageRequests.length > 0
          ? await this.getBatchImageInfo(imageRequests.map((r) => r.imageTitle))
          : new Map<string, any>();

      // 3. ページデータと画像情報を合わせて Species を更新
      for (const [title, pageData] of pageDataMap) {
        const s = titleToSpecies.get(title);
        if (!s) continue;

        const imageReq = imageRequests.find((r) => r.speciesId === s.id);
        const imageInfo = imageReq ? imageInfoMap.get(imageReq.imageTitle) : null;

        results.set(s.id, {
          ...s,
          wikipediaUrl:
            s.wikipediaUrl || `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          description: pageData.extract,
          wikipediaImage: imageInfo
            ? {
                url: imageInfo.url,
                attribution: 'Wikimedia Commons',
                license: imageInfo.extmetadata?.License?.value || 'Unknown',
                author: this.cleanHTML(imageInfo.extmetadata?.Artist?.value || 'Unknown'),
              }
            : undefined,
        });

        processed++;
        onProgress?.(processed, species.length, `Wikipedia情報を取得中... (${processed}/${species.length})`);
      }

      // titleToSpecies に含まれていたが pageDataMap に返らなかった種（404等）を処理済みにカウント
      const unmatchedCount = chunk.length - titleToSpecies.size + (titleToSpecies.size - pageDataMap.size);
      if (unmatchedCount > 0) {
        processed += unmatchedCount;
        onProgress?.(processed, species.length, `Wikipedia情報を取得中... (${processed}/${species.length})`);
      }
    }

    // ── 無URL種: 5件並列チャンクで個別処理 ──────────────────────
    const parallelChunkSize = 5;
    for (let i = 0; i < withoutUrl.length; i += parallelChunkSize) {
      const chunk = withoutUrl.slice(i, i + parallelChunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map((s) => this.enrichSpeciesWithWikipedia(s))
      );

      chunkResults.forEach((result, index) => {
        const s = chunk[index];
        results.set(s.id, result.status === 'fulfilled' ? result.value : s);
        processed++;
      });

      onProgress?.(processed, species.length, `Wikipedia情報を取得中... (${processed}/${species.length})`);
    }

    // 元の順序で返す
    return species.map((s) => results.get(s.id) || s);
  }

  async enrichSpeciesWithWikipedia(species: Species): Promise<Species> {
    try {
      let pageTitle: string | null = null;

      // 1. iNaturalistからのWikipedia URLを優先使用
      if (species.wikipediaUrl) {
        pageTitle = this.extractPageTitleFromUrl(species.wikipediaUrl);
        console.log(`Using Wikipedia URL from iNaturalist: ${species.wikipediaUrl}`);
      }

      // 2. URLがない場合のみ検索
      if (!pageTitle) {
        let pageInfo = await this.searchPage(species.scientificName);

        if (!pageInfo && species.commonName) {
          console.log(`No page found for scientific name: ${species.scientificName}, trying common name...`);
          pageInfo = await this.searchPage(species.commonName);
        }

        if (!pageInfo) {
          console.log(`No Wikipedia page found for: ${species.scientificName}`);
          return species;
        }

        pageTitle = pageInfo.title;
      }

      // 3. 1回のリクエストで記事内容と画像一覧を取得
      const pageData = await this.getPageData(pageTitle);

      if (!pageData) {
        console.log(`Failed to get page data for: ${pageTitle}`);
        return species;
      }

      // 4. 画像がある場合のみ詳細情報を取得
      let image = null;
      if (pageData.images && pageData.images.length > 0) {
        image = await this.getImageInfo(pageData.images[0].title);
      }

      return {
        ...species,
        wikipediaUrl: species.wikipediaUrl || `https://ja.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
        description: pageData.extract,
        wikipediaImage: image
          ? {
              url: image.url,
              attribution: 'Wikimedia Commons',
              license: image.extmetadata?.License?.value || 'Unknown',
              author: this.cleanHTML(image.extmetadata?.Artist?.value || 'Unknown'),
            }
          : undefined,
      };
    } catch (error) {
      console.warn(`Wikipedia enrichment failed for ${species.scientificName}:`, error);
      return species;
    }
  }

  /**
   * Wikipedia URLからページタイトルを抽出
   */
  private extractPageTitleFromUrl(url: string): string | null {
    try {
      const match = url.match(/\/wiki\/(.+)$/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 複数ページの本文と画像ファイル名一覧を1リクエストで一括取得
   * @param titles パイプ区切りのページタイトル（例: "タイトル1|タイトル2|..."）
   * @returns タイトル → {extract, images} のマップ
   */
  private async getBatchPageData(
    titles: string
  ): Promise<Map<string, { extract: string; images: any[] }>> {
    try {
      const response = await this.requestWithRetry<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'extracts|images',
          exintro: true,
          explaintext: true,
          titles,
          origin: '*',
        },
      });

      const pages = response.query?.pages;
      if (!pages) return new Map();

      const result = new Map<string, { extract: string; images: any[] }>();
      for (const page of Object.values(pages) as any[]) {
        if (page.title && page.pageid !== -1) {
          result.set(page.title, {
            extract: page.extract || '',
            images: page.images || [],
          });
        }
      }
      return result;
    } catch (error) {
      console.error('Wikipedia batch page data error:', error);
      return new Map();
    }
  }

  /**
   * 複数画像ファイルの詳細情報（URL・ライセンス・著作者）を1リクエストで一括取得
   * @param imageTitles 画像ファイル名の配列（例: ["File:A.jpg", "File:B.jpg"]）
   * @returns ファイル名 → imageinfo のマップ
   */
  private async getBatchImageInfo(imageTitles: string[]): Promise<Map<string, any>> {
    if (imageTitles.length === 0) return new Map();

    try {
      const response = await this.requestWithRetry<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          titles: imageTitles.join('|'),
          origin: '*',
        },
      });

      const pages = response.query?.pages;
      if (!pages) return new Map();

      const result = new Map<string, any>();
      for (const page of Object.values(pages) as any[]) {
        if (page.title && page.imageinfo?.[0]) {
          result.set(page.title, page.imageinfo[0]);
        }
      }
      return result;
    } catch (error) {
      console.error('Wikipedia batch imageinfo error:', error);
      return new Map();
    }
  }

  /**
   * 1回のリクエストでページの内容と画像一覧を取得
   */
  private async getPageData(title: string): Promise<{ extract: string; images: any[] } | null> {
    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'extracts|images',
          exintro: true,
          explaintext: true,
          titles: title,
          origin: '*',
        },
      });

      const pages = response.query?.pages;
      if (!pages) return null;

      const page = Object.values(pages)[0] as any;
      return {
        extract: page.extract || '',
        images: page.images || [],
      };
    } catch (error) {
      console.error('Wikipedia page data error:', error);
      return null;
    }
  }

  private async searchPage(searchTerm: string): Promise<{ title: string } | null> {
    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          list: 'search',
          srsearch: searchTerm,
          srlimit: 1,
          origin: '*',
        },
      });

      const results = response.query?.search;
      return results && results.length > 0 ? { title: results[0].title } : null;
    } catch (error) {
      console.error('Wikipedia search error:', error);
      return null;
    }
  }

  private async getImageInfo(imageTitle: string): Promise<WikipediaImageInfo | null> {
    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          titles: imageTitle,
          origin: '*',
        },
      });

      const pages = response.query?.pages;
      if (!pages) return null;

      const page = Object.values(pages)[0] as any;
      if (!page.imageinfo || page.imageinfo.length === 0) {
        return null;
      }

      return page.imageinfo[0];
    } catch (error) {
      console.error('Wikipedia imageinfo error:', error);
      return null;
    }
  }

  private cleanHTML(html: string): string {
    // 簡易的なHTMLタグ除去
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
