import type { Species } from '@types/species';
import type { WikipediaSearchResult, WikipediaPage, WikipediaImageInfo } from '@types/api';
import { APIClient } from './apiClient';

export class WikipediaAPI extends APIClient {
  constructor() {
    super('https://ja.wikipedia.org/w/api.php');
  }

  async enrichSpeciesWithWikipedia(species: Species): Promise<Species> {
    try {
      // 1. 学名または和名で記事検索
      const searchTerm = species.commonName || species.scientificName;
      const pageInfo = await this.searchPage(searchTerm);

      if (!pageInfo) {
        console.log(`No Wikipedia page found for: ${searchTerm}`);
        return species;
      }

      // 2. 記事の導入部取得
      const extract = await this.getExtract(pageInfo.pageid);

      // 3. メイン画像取得
      const image = await this.getMainImage(pageInfo.pageid);

      return {
        ...species,
        wikipediaUrl: `https://ja.wikipedia.org/?curid=${pageInfo.pageid}`,
        description: extract,
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

  private async searchPage(searchTerm: string): Promise<WikipediaSearchResult | null> {
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
      return results && results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Wikipedia search error:', error);
      return null;
    }
  }

  private async getExtract(pageid: number): Promise<string> {
    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'extracts',
          exintro: true,
          explaintext: true,
          pageids: pageid,
          origin: '*',
        },
      });

      const page = response.query?.pages?.[pageid];
      return page?.extract || '';
    } catch (error) {
      console.error('Wikipedia extract error:', error);
      return '';
    }
  }

  private async getMainImage(pageid: number): Promise<WikipediaImageInfo | null> {
    try {
      // 1. ページの画像一覧取得
      const imagesResponse = await this.request<any>({
        method: 'GET',
        url: '',
        params: {
          action: 'query',
          format: 'json',
          prop: 'images',
          pageids: pageid,
          origin: '*',
        },
      });

      const page = imagesResponse.query?.pages?.[pageid];
      if (!page?.images || page.images.length === 0) {
        return null;
      }

      // 最初の画像の詳細情報取得
      const imageTitle = page.images[0].title;
      return await this.getImageInfo(imageTitle);
    } catch (error) {
      console.error('Wikipedia image error:', error);
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
