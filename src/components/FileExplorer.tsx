import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FileImage,
  FilePlus,
  FolderPlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  File,
  Code2,
  Image as ImageIcon
} from 'lucide-react';
import { FileItem, FileTreeNode, LanguageMode } from '../types';
import { isImageExtension } from '../utils/languageHelper';

interface FileExplorerProps {
  tree: FileTreeNode[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
  onDeleteNode: (path: string) => void;
  onCreateFile: (parentFolder: string, fileName: string) => void;
  onCreateFolder: (parentFolder: string, folderName: string) => void;
  lang: LanguageMode;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activePath,
  onSelectFile,
  onDeleteNode,
  onCreateFile,
  onCreateFolder,
  lang,
}) => {
  const [filterText, setFilterText] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(['src', 'public'])
  );

  // Modal / Inline input state for adding new file/folder
  const [creatingParent, setCreatingParent] = useState<string | null>(null);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');

  const isFa = lang === 'fa';

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleStartCreate = (parentFolder: string, type: 'file' | 'folder') => {
    setCreatingParent(parentFolder);
    setCreateType(type);
    setNewItemName('');
    // Ensure parent is expanded
    if (parentFolder) {
      setExpandedPaths((prev) => new Set(prev).add(parentFolder));
    }
  };

  const handleConfirmCreate = () => {
    if (!newItemName.trim()) return;
    const parent = creatingParent || '';
    if (createType === 'file') {
      onCreateFile(parent, newItemName.trim());
    } else {
      onCreateFolder(parent, newItemName.trim());
    }
    setCreatingParent(null);
    setNewItemName('');
  };

  const renderFileIcon = (filename: string, isFolder: boolean, isOpen: boolean) => {
    if (isFolder) {
      return isOpen ? (
        <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
      ) : (
        <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
      );
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (isImageExtension(filename)) {
      return <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }

    switch (ext) {
      case 'html':
      case 'htm':
        return <Code2 className="w-4 h-4 text-orange-400 flex-shrink-0" />;
      case 'css':
      case 'scss':
        return <FileCode className="w-4 h-4 text-sky-400 flex-shrink-0" />;
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
      case 'ts':
      case 'tsx':
        return <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-amber-300 flex-shrink-0" />;
      case 'md':
        return <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />;
      case 'py':
        return <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
      default:
        return <File className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    }
  };

  const renderTreeNodes = (nodes: FileTreeNode[], depth: number = 0) => {
    return nodes.map((node) => {
      // Filter logic
      if (
        filterText &&
        !node.name.toLowerCase().includes(filterText.toLowerCase()) &&
        !node.children?.some((c) =>
          c.name.toLowerCase().includes(filterText.toLowerCase())
        )
      ) {
        return null;
      }

      const isExpanded = expandedPaths.has(node.path);
      const isSelected = activePath === node.path;

      return (
        <div key={node.path} className="select-none text-xs">
          <div
            className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
              isSelected
                ? 'bg-sky-600/30 text-sky-200 border-l-2 border-sky-400 font-medium'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.isFolder) {
                toggleExpand(node.path);
              } else {
                onSelectFile(node.path);
              }
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {node.isFolder ? (
                <span className="text-slate-500 hover:text-slate-300">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </span>
              ) : (
                <span className="w-3.5 h-3.5"></span>
              )}

              {renderFileIcon(node.name, node.isFolder, isExpanded)}
              <span className="truncate">{node.name}</span>
            </div>

            {/* Hover Actions */}
            <div className="hidden group-hover:flex items-center gap-1 opacity-90">
              {node.isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreate(node.path, 'file');
                    }}
                    title={isFa ? 'ایجاد فایل جدید' : 'New File'}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-sky-300"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreate(node.path, 'folder');
                    }}
                    title={isFa ? 'ایجاد پوشه جدید' : 'New Folder'}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-amber-300"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(
                      isFa
                        ? `آیا از حذف "${node.name}" مطمئن هستید؟`
                        : `Delete "${node.name}"?`
                    )
                  ) {
                    onDeleteNode(node.path);
                  }
                }}
                title={isFa ? 'حذف' : 'Delete'}
                className="p-1 hover:bg-rose-950/80 rounded text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Children */}
          {node.isFolder && isExpanded && (
            <div>
              {/* Inline input if creating inside this folder */}
              {creatingParent === node.path && (
                <div
                  className="flex items-center gap-1 px-2 py-1 my-1"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                >
                  <input
                    type="text"
                    autoFocus
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmCreate();
                      if (e.key === 'Escape') setCreatingParent(null);
                    }}
                    placeholder={
                      createType === 'file'
                        ? 'filename.ext'
                        : 'folder-name'
                    }
                    className="w-full bg-slate-950 text-slate-100 text-xs px-2 py-1 rounded border border-sky-500 focus:outline-none"
                  />
                  <button
                    onClick={handleConfirmCreate}
                    className="bg-sky-600 text-white text-[10px] px-2 py-1 rounded hover:bg-sky-500"
                  >
                    {isFa ? 'ثبت' : 'Add'}
                  </button>
                </div>
              )}

              {node.children && node.children.length > 0 ? (
                renderTreeNodes(node.children, depth + 1)
              ) : (
                <div
                  className="text-[11px] text-slate-600 italic py-1"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}
                >
                  {isFa ? 'پوشه خالی است' : 'Empty folder'}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      id="file-explorer-sidebar"
      className="w-64 bg-slate-900/95 border-r border-slate-800 text-slate-200 flex flex-col flex-shrink-0 h-full select-none"
    >
      {/* Header & Quick Action Buttons */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {isFa ? 'ساختار فایل‌ها (ZIP)' : 'ZIP File Tree'}
        </span>

        <div className="flex items-center gap-1">
          <button
            id="btn-add-root-file"
            onClick={() => handleStartCreate('', 'file')}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-sky-300 transition-colors"
            title={isFa ? 'افزودن فایل در ریشه' : 'New File in Root'}
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            id="btn-add-root-folder"
            onClick={() => handleStartCreate('', 'folder')}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-300 transition-colors"
            title={isFa ? 'افزودن پوشه در ریشه' : 'New Folder in Root'}
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Input */}
      <div className="px-3 py-2 border-b border-slate-800/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder={isFa ? 'فیلتر فایل‌ها...' : 'Filter files...'}
            className="w-full bg-slate-950 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-md border border-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Root level create input */}
      {creatingParent === '' && (
        <div className="p-2 border-b border-slate-800 flex items-center gap-1">
          <input
            type="text"
            autoFocus
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') setCreatingParent(null);
            }}
            placeholder={
              createType === 'file' ? 'filename.ext' : 'folder-name'
            }
            className="w-full bg-slate-950 text-slate-100 text-xs px-2 py-1 rounded border border-sky-500 focus:outline-none"
          />
          <button
            onClick={handleConfirmCreate}
            className="bg-sky-600 text-white text-[10px] px-2 py-1 rounded hover:bg-sky-500"
          >
            {isFa ? 'ثبت' : 'Add'}
          </button>
        </div>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {tree.length > 0 ? (
          renderTreeNodes(tree)
        ) : (
          <div className="text-center text-slate-500 text-xs py-10 px-4">
            <p className="mb-2">
              {isFa
                ? 'هیچ فایلی یافت نشد. یک فایل زیپ آپلود کنید یا پروژه جدید بسازید.'
                : 'No files extracted. Upload a ZIP file or create new files.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
