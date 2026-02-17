import { useState, useEffect } from 'react';
import type { TaxonNode } from '@types/taxonomy';
import './TaxonSelectionModal.css';

interface TaxonSelectionModalProps {
  isOpen: boolean;
  taxonomyTree: TaxonNode[];
  onConfirm: (selection: Record<string, boolean>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  progress?: {
    current: number;
    total: number;
    message: string;
  } | null;
}

export function TaxonSelectionModal({ isOpen, taxonomyTree, onConfirm, onCancel, isLoading, progress }: TaxonSelectionModalProps) {
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // 初期状態：すべての門を選択
  useEffect(() => {
    if (isOpen && taxonomyTree.length > 0) {
      const initialSelection: Record<string, boolean> = {};
      taxonomyTree.forEach((phylumNode) => {
        const key = `${phylumNode.rank}:${phylumNode.name}`;
        initialSelection[key] = true;
      });
      setSelection(initialSelection);

      // すべての門を展開
      const expanded = new Set<string>();
      taxonomyTree.forEach((phylumNode) => {
        const key = `${phylumNode.rank}:${phylumNode.name}`;
        expanded.add(key);
      });
      setExpandedNodes(expanded);
    }
  }, [isOpen, taxonomyTree]);

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  const handleCheckboxChange = (key: string, node: TaxonNode) => {
    const newSelection = { ...selection };
    const isChecked = !selection[key];

    // このノードを選択/解除
    newSelection[key] = isChecked;

    // 子ノード（綱）も同時に選択/解除
    if (node.rank === 'phylum') {
      node.children.forEach((classNode) => {
        const classKey = `${classNode.rank}:${classNode.name}`;
        if (isChecked) {
          delete newSelection[classKey]; // 親が選択されたら子の選択を削除
        }
      });
    }

    // 親ノード（門）の処理
    if (node.rank === 'class') {
      // 綱が選択された場合、門の選択を解除
      const parentPhylum = taxonomyTree.find((p) =>
        p.children.some((c) => c.name === node.name)
      );
      if (parentPhylum) {
        const phylumKey = `${parentPhylum.rank}:${parentPhylum.name}`;
        delete newSelection[phylumKey];
      }
    }

    setSelection(newSelection);
  };

  const handleSelectAll = () => {
    const newSelection: Record<string, boolean> = {};
    taxonomyTree.forEach((phylumNode) => {
      const key = `${phylumNode.rank}:${phylumNode.name}`;
      newSelection[key] = true;
    });
    setSelection(newSelection);
  };

  const handleDeselectAll = () => {
    setSelection({});
  };

  const handleConfirm = () => {
    onConfirm(selection);
  };

  const getSelectedCount = () => {
    let count = 0;
    taxonomyTree.forEach((phylumNode) => {
      const phylumKey = `${phylumNode.rank}:${phylumNode.name}`;
      if (selection[phylumKey]) {
        count += phylumNode.count;
      } else {
        phylumNode.children.forEach((classNode) => {
          const classKey = `${classNode.rank}:${classNode.name}`;
          if (selection[classKey]) {
            count += classNode.count;
          }
        });
      }
    });
    return count;
  };

  if (!isOpen) return null;

  const selectedCount = getSelectedCount();
  const totalCount = taxonomyTree.reduce((sum, node) => sum + node.count, 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>図鑑に含める分類群を選択</h2>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {(isLoading || taxonomyTree.length === 0) && progress && (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p className="loading-message">{progress.message}</p>
              {progress.total > 0 && (
                <>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="loading-progress">
                    {progress.current} / {progress.total}
                  </p>
                </>
              )}
            </div>
          )}

          {!isLoading && taxonomyTree.length > 0 && (
            <>
              <div className="selection-info">
            <p>
              選択中: <strong>{selectedCount}</strong> / {totalCount} 種
            </p>
            <div className="selection-actions">
              <button onClick={handleSelectAll} className="btn-secondary">
                すべて選択
              </button>
              <button onClick={handleDeselectAll} className="btn-secondary">
                すべて解除
              </button>
            </div>
          </div>

          <div className="taxonomy-tree">
            {taxonomyTree.map((phylumNode) => {
              const phylumKey = `${phylumNode.rank}:${phylumNode.name}`;
              const isExpanded = expandedNodes.has(phylumKey);
              const isChecked = selection[phylumKey] || false;

              return (
                <div key={phylumKey} className={`tree-node tree-node--${phylumNode.rank}`}>
                  <div className="tree-node-header">
                    <button
                      className="expand-button"
                      onClick={() => toggleExpand(phylumKey)}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <label className="tree-node-label">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCheckboxChange(phylumKey, phylumNode)}
                      />
                      <span className="tree-node-name">
                        {phylumNode.name} <span className="tree-node-count">({phylumNode.count}種)</span>
                      </span>
                    </label>
                  </div>

                  {isExpanded && (
                    <div className="tree-node-children">
                      {phylumNode.children.map((classNode) => {
                        const classKey = `${classNode.rank}:${classNode.name}`;
                        const isClassChecked = selection[classKey] || isChecked;

                        return (
                          <div key={classKey} className={`tree-node tree-node--${classNode.rank}`}>
                            <label className="tree-node-label">
                              <input
                                type="checkbox"
                                checked={isClassChecked}
                                disabled={isChecked}
                                onChange={() => handleCheckboxChange(classKey, classNode)}
                              />
                              <span className="tree-node-name">
                                {classNode.name} <span className="tree-node-count">({classNode.count}種)</span>
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onCancel} className="btn-secondary">
            キャンセル
          </button>
          <button onClick={handleConfirm} className="btn-primary" disabled={selectedCount === 0 || isLoading}>
            選択した分類群で図鑑を作成 ({selectedCount}種)
          </button>
        </div>
      </div>
    </div>
  );
}
