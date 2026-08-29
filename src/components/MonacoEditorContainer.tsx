import React from 'react';
import Editor, { OnChange, OnMount } from '@monaco-editor/react';
import { FileItem, IDETheme, LanguageMode } from '../types';
import { FileCode, Image as ImageIcon, Sparkles, Upload } from 'lucide-react';

interface MonacoEditorContainerProps {
  activeFile: FileItem | null;
  onContentChange: (path: string, newContent: string) => void;
  theme: IDETheme;
  lang: LanguageMode;
  onOpenSample: () => void;
  onUploadClick: () => void;
}

export const MonacoEditorContainer: React.FC<MonacoEditorContainerProps> = ({
  activeFile,
  onContentChange,
  theme,
  lang,
  onOpenSample,
  onUploadClick,
}) => {
  const isFa = lang === 'fa';

  if (!activeFile) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-inner">
          <FileCode className="w-8 h-8 text-sky-400 animate-bounce" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-2">
          {isFa
            ? 'یک فایل را برای مشاهده یا ویرایش انتخاب کنید'
            : 'Select a file to view or edit'}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          {isFa
            ? 'می‌توانید یک فایل زیپ (ZIP) حاوی پروژه برنامه‌نویسی را آپلود کنید یا پروژه نمونه پیش‌فرض را بارگذاری نمایید.'
            : 'Upload any source code ZIP archive or load the built-in sample web app to start editing and exploring.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{isFa ? 'بارگذاری فایل زیپ' : 'Upload ZIP Archive'}</span>
          </button>

          <button
            onClick={onOpenSample}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs px-4 py-2.5 rounded-lg border border-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{isFa ? 'اجرای پروژه نمونه' : 'Open Sample Project'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Handle Binary/Image file view
  if (activeFile.isBinary && activeFile.binaryData) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-auto">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl flex flex-col items-center max-w-xl">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>{activeFile.name}</span>
          </div>
          <img
            src={activeFile.binaryData}
            alt={activeFile.name}
            className="max-h-[70vh] max-w-full object-contain rounded-lg border border-slate-800 bg-slate-950/50"
          />
          <p className="text-[11px] text-slate-500 mt-3">
            {isFa
              ? 'پیش‌نمایش تصویر غیرمتنی'
              : 'Binary / Image Asset Preview'}
          </p>
        </div>
      </div>
    );
  }

  const handleEditorChange: OnChange = (value) => {
    if (value !== undefined) {
      onContentChange(activeFile.path, value);
    }
  };

  const monacoTheme = theme === 'light' ? 'light' : 'vs-dark';

  return (
    <div className="flex-1 relative w-full h-full bg-slate-950 overflow-hidden">
      <Editor
        height="100%"
        language={activeFile.language || 'plaintext'}
        value={activeFile.content || ''}
        onChange={handleEditorChange}
        theme={monacoTheme}
        options={{
          fontSize: 14,
          fontFamily: `'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace`,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
      />
    </div>
  );
};
