import pdfMake from 'pdfmake/build/pdfmake';
import type { Species } from '@types/species';
import { format } from 'date-fns';

// フォントの設定を試みる（エラーを無視）
try {
  import('pdfmake/build/vfs_fonts').then((pdfFonts) => {
    const fonts = (pdfFonts as any).default || pdfFonts;
    if (fonts.pdfMake?.vfs) {
      (pdfMake as any).vfs = fonts.pdfMake.vfs;
    } else if (fonts.vfs) {
      (pdfMake as any).vfs = fonts.vfs;
    } else {
      (pdfMake as any).vfs = fonts;
    }
  }).catch((err) => {
    console.warn('Font loading failed, using default fonts:', err);
  });
} catch (error) {
  console.warn('Font setup failed:', error);
}

const RANK_TRANSLATIONS: Record<string, string> = {
  species: '種',
  genus: '属',
  family: '科',
  order: '目',
  class: '綱',
  phylum: '門',
  kingdom: '界',
};

export class PDFExporter {
  async export(species: Species[], title: string = '野外観察図鑑'): Promise<void> {
    try {
      console.log('Generating PDF...');
      const docDefinition = await this.createDocDefinition(species, title);

      pdfMake.createPdf(docDefinition as any).download(
        `${title}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      );

      console.log('PDF generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  private async createDocDefinition(species: Species[], title: string): Promise<any> {
    // 画像をDataURLに変換（並列処理）
    const speciesWithImages = await Promise.all(
      species.map(async (s) => {
        const imageUrl = s.photos[0]?.url;
        let dataUrl: string | null = null;

        if (imageUrl) {
          try {
            dataUrl = await this.imageToDataURL(imageUrl);
          } catch (error) {
            console.warn(`Failed to load image for ${s.scientificName}:`, error);
          }
        }

        return { ...s, dataUrl };
      })
    );

    return {
      content: [
        // タイトル
        {
          text: title,
          style: 'header',
        },
        {
          text: `作成日: ${format(new Date(), 'yyyy年MM月dd日')}`,
          style: 'subheader',
        },
        {
          text: `観察種数: ${species.length}種`,
          style: 'subheader',
          margin: [0, 0, 0, 20],
        },

        // 生物リスト
        ...speciesWithImages.flatMap((s, index) => this.createSpeciesSection(s, index + 1)),

        // フッター
        {
          text: '\n\nこのデータは iNaturalist から取得されました。',
          style: 'footer',
        },
        {
          text: '各画像・情報のライセンスは個別に記載されています。',
          style: 'footer',
        },
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 10],
        },
        subheader: {
          fontSize: 14,
          margin: [0, 0, 0, 5],
        },
        speciesHeader: {
          fontSize: 16,
          bold: true,
          margin: [0, 20, 0, 5],
        },
        scientific: {
          fontSize: 12,
          italics: true,
          color: '#666666',
        },
        meta: {
          fontSize: 10,
          margin: [0, 5, 0, 5],
        },
        attribution: {
          fontSize: 8,
          color: '#999999',
          margin: [0, 5, 0, 0],
        },
        footer: {
          fontSize: 9,
          color: '#666666',
          alignment: 'center',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
    };
  }

  private createSpeciesSection(
    species: Species & { dataUrl?: string | null },
    index: number
  ): any[] {
    const rankJa = RANK_TRANSLATIONS[species.rank] || species.rank;
    const attribution = species.photos[0]?.attribution;

    const sections: any[] = [
      {
        text: `${index}. ${species.commonName || species.scientificName}`,
        style: 'speciesHeader',
        pageBreak: index > 1 ? 'before' : undefined,
      },
      {
        text: species.scientificName,
        style: 'scientific',
      },
      {
        text: `分類階級: ${rankJa} | 観察数: ${species.observationCount}`,
        style: 'meta',
      },
    ];

    // 画像追加
    if (species.dataUrl) {
      sections.push({
        image: species.dataUrl,
        width: 400,
        margin: [0, 10, 0, 5],
      });

      if (attribution) {
        sections.push({
          text: `出典: ${attribution}`,
          style: 'attribution',
        });
      }
    }

    return sections;
  }

  private async imageToDataURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataURL);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      // CORS対策: プロキシを使用するか、画像URLに直接アクセス
      img.src = url;
    });
  }
}
