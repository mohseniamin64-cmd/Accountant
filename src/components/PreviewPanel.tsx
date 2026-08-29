import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Code2,
  AlertCircle
} from 'lucide-react';
import { FileItem, LanguageMode } from '../types';

interface PreviewPanelProps {
  filesMap: Record<string, FileItem>;
  activeFile: FileItem | null;
  onClose: () => void;
  lang: LanguageMode;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  filesMap,
  activeFile,
  onClose,
  lang,
}) => {
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [key, setKey] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isFa = lang === 'fa';

  const buildWebSandbox = () => {
    try {
      setErrorMsg(null);

      // 1. Find target HTML file
      let targetHtmlPath = '';

      if (activeFile && activeFile.name.endsWith('.html')) {
        targetHtmlPath = activeFile.path;
      } else {
        // Look for index.html in filesMap
        const indexCandidates = [
          'index.html',
          'src/index.html',
          'public/index.html',
        ];
        const found = indexCandidates.find((path) => filesMap[path]);
        if (found) {
          targetHtmlPath = found;
        } else {
          // Find any html file
          const anyHtml = Object.keys(filesMap).find((p) => p.endsWith('.html'));
          if (anyHtml) {
            targetHtmlPath = anyHtml;
          }
        }
      }

      if (!targetHtmlPath || !filesMap[targetHtmlPath]) {
        setErrorMsg(
          isFa
            ? 'هیچ فایل HTML برای پیش‌نمایش در فایل زیپ پیدا نشد.'
            : 'No HTML file found in the ZIP archive to preview.'
        );
        return;
      }

      let htmlContent = filesMap[targetHtmlPath].content || '';

      // Base path for resolving relative links e.g. "src/index.html" -> "src"
      const pathParts = targetHtmlPath.split('/');
      pathParts.pop();
      const basePath = pathParts.join('/');

      // Function to resolve relative path
      const resolveRelative = (rel: string) => {
        if (rel.startsWith('/')) rel = rel.slice(1);
        if (!basePath) return rel;
        if (rel.startsWith('./')) rel = rel.slice(2);
        return `${basePath}/${rel}`;
      };

      // Inline CSS link tags e.g. <link rel="stylesheet" href="style.css">
      htmlContent = htmlContent.replace(
        /<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi,
        (match, href) => {
          if (href.startsWith('http://') || href.startsWith('https://')) return match;
          const cssPath = resolveRelative(href);
          const cssItem = filesMap[cssPath] || filesMap[href];
          if (cssItem && cssItem.content) {
            return `<style>${cssItem.content}</style>`;
          }
          return match;
        }
      );

      // Inline JS script tags e.g. <script src="script.js"></script>
      htmlContent = htmlContent.replace(
        /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
        (match, src) => {
          if (src.startsWith('http://') || src.startsWith('https://')) return match;
          const jsPath = resolveRelative(src);
          const jsItem = filesMap[jsPath] || filesMap[src];
          if (jsItem && jsItem.content) {
            return `<script>${jsItem.content}</script>`;
          }
          return match;
        }
      );

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setIframeSrc(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating preview bundle');
    }
  };

  useEffect(() => {
    buildWebSandbox();
  }, [filesMap, activeFile, key]);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const handleOpenNewTab = () => {
    if (iframeSrc) {
      window.open(iframeSrc, '_blank');
    }
  };

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[375px]';
      case 'tablet':
        return 'w-[768px]';
      case 'desktop':
      default:
        return 'w-full';
    }
  };

  return (
    <div
      id="live-preview-panel"
      className="w-1/2 min-w-[320px] bg-slate-900 border-l border-slate-800 flex flex-col h-full flex-shrink-0 z-20"
    >
      {/* Header bar */}
      <div className="h-10 bg-slate-950 px-3 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">
            {isFa ? 'پیش‌نمایش زنده خروجی' : 'Live Web Preview Sandbox'}
          </span>
        </div>

        {/* Viewport Toggles */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-md border border-slate-800">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1 rounded text-xs transition-colors ${
              viewport === 'desktop'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isFa ? 'نمای دسکتاپ' : 'Desktop View'}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1 rounded text-xs transition-colors ${
              viewport === 'tablet'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isFa ? 'نمای تبلت' : 'Tablet View'}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1 rounded text-xs transition-colors ${
              viewport === 'mobile'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isFa ? 'نمای موبایل' : 'Mobile View'}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
            title={isFa ? 'بروزرسانی پیش‌نمایش' : 'Refresh Preview'}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenNewTab}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
            title={isFa ? 'بازکردن در تب جدید' : 'Open in New Tab'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded transition-colors"
            title={isFa ? 'بستن پیش‌نمایش' : 'Close Preview'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-slate-950 p-3 flex justify-center items-center overflow-auto">
        {errorMsg ? (
          <div className="flex flex-col items-center justify-center text-rose-400 p-6 text-center max-w-sm">
            <AlertCircle className="w-8 h-8 mb-2 text-rose-500" />
            <p className="text-xs">{errorMsg}</p>
          </div>
        ) : (
          <div
            className={`h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 border border-slate-800 ${getViewportWidth()}`}
          >
            <iframe
              key={key}
              src={iframeSrc}
              title="App Sandbox Preview"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
            />
          </div>
        )}
      </div>
    </div>
  );
};
