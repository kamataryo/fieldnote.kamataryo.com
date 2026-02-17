import { useState } from 'react';
import { useAppStore } from '@store/appStore';
import { HTMLExporter } from '@services/export/htmlExporter';
import { PDFExporter } from '@services/export/pdfExporter';
import './ExportPanel.css';

export function ExportPanel() {
  const { species } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'pdf'>('html');

  const handleExport = async () => {
    if (species.length === 0) {
      alert('エクスポートする生物データがありません。地図上でポリゴンを描画してください。');
      return;
    }

    setIsExporting(true);

    try {
      const title = '野外観察図鑑';

      if (exportFormat === 'html') {
        const exporter = new HTMLExporter();
        exporter.export(species, title);
      } else if (exportFormat === 'pdf') {
        const exporter = new PDFExporter();
        await exporter.export(species, title);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('エクスポートに失敗しました。コンソールを確認してください。');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <h3 className="export-panel__title">図鑑をエクスポート</h3>

      <div className="export-panel__format">
        <label className="format-option">
          <input
            type="radio"
            name="format"
            value="html"
            checked={exportFormat === 'html'}
            onChange={(e) => setExportFormat(e.target.value as 'html')}
          />
          <span>HTML（印刷可能）</span>
        </label>

        <label className="format-option">
          <input
            type="radio"
            name="format"
            value="pdf"
            checked={exportFormat === 'pdf'}
            onChange={(e) => setExportFormat(e.target.value as 'pdf')}
          />
          <span>PDF</span>
        </label>
      </div>

      <button
        onClick={handleExport}
        disabled={species.length === 0 || isExporting}
        className="export-button"
      >
        {isExporting ? 'エクスポート中...' : `${exportFormat.toUpperCase()} をダウンロード`}
      </button>

      {species.length > 0 && (
        <p className="export-panel__info">{species.length}種の図鑑を作成します</p>
      )}
    </div>
  );
}
