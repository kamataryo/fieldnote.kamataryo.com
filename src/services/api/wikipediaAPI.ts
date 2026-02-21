import type { Species } from '@types/species';
import type { WikipediaSearchResult, WikipediaPage, WikipediaImageInfo } from '@types/api';
import { APIClient, RateLimiter } from './apiClient';

export class WikipediaAPI extends APIClient {
  constructor() {
    // 10回/分に制限
    super('https://ja.wikipedia.org/w/api.php', new RateLimiter(10, 60000));
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
