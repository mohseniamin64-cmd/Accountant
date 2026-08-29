import React, { useState } from 'react';
import {
  Bot,
  X,
  Sparkles,
  Bug,
  Wand2,
  HelpCircle,
  Copy,
  Check,
  Send,
  Loader2,
  FileCode,
  ArrowRightLeft
} from 'lucide-react';
import { FileItem, LanguageMode } from '../types';

interface AIAssistantDrawerProps {
  activeFile: FileItem | null;
  onApplyCode: (newCode: string) => void;
  onClose: () => void;
  lang: LanguageMode;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  activeFile,
  onApplyCode,
  onClose,
  lang,
}) => {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [customQuestion, setCustomQuestion] = useState<string>('');

  const isFa = lang === 'fa';

  const callAiAssistant = async (task: 'explain' | 'find-bugs' | 'refactor' | 'custom', questionText?: string) => {
    if (!activeFile && task !== 'custom') {
      setError(
        isFa
          ? 'لطفاً ابتدا یک فایل را در ویرایشگر انتخاب کنید.'
          : 'Please select a file in the editor first.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/code-assistant', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          task,
          code: activeFile?.content || '',
          language: activeFile?.language || 'plaintext',
          filePath: activeFile?.path || 'file',
          question: questionText || customQuestion,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI Request failed');
      }

      setResponse(data.result);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with AI model.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper to extract code block from markdown response if user wants to apply to editor
  const handleApplyToEditor = () => {
    if (!response) return;
    const match = response.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
    if (match && match[1]) {
      onApplyCode(match[1]);
    } else {
      onApplyCode(response);
    }
  };

  return (
    <aside
      id="ai-assistant-sidebar"
      className="w-96 bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full flex-shrink-0 z-20"
    >
      {/* Header */}
      <div className="h-12 bg-slate-950 px-4 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-600/20 text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-200">
              {isFa ? 'دستیار هوش مصنوعی کد (Gemini)' : 'AI Code Assistant'}
            </h3>
            <span className="text-[10px] text-slate-500">
              {activeFile ? activeFile.name : (isFa ? 'هیچ فایلی انتخاب نشده' : 'No file selected')}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          title={isFa ? 'بستن' : 'Close AI Drawer'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Quick Action Cards */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => callAiAssistant('explain')}
            disabled={loading || !activeFile}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-slate-200 text-xs gap-1.5 transition-all disabled:opacity-50 cursor-pointer text-center"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{isFa ? 'توضیح کد' : 'Explain File'}</span>
          </button>

          <button
            onClick={() => callAiAssistant('find-bugs')}
            disabled={loading || !activeFile}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-slate-200 text-xs gap-1.5 transition-all disabled:opacity-50 cursor-pointer text-center"
          >
            <Bug className="w-4 h-4 text-rose-400" />
            <span>{isFa ? 'بررسی باگ‌ها' : 'Find Bugs'}</span>
          </button>

          <button
            onClick={() => callAiAssistant('refactor')}
            disabled={loading || !activeFile}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-200 text-xs gap-1.5 transition-all disabled:opacity-50 cursor-pointer text-center col-span-2"
          >
            <Wand2 className="w-4 h-4 text-emerald-400" />
            <span>{isFa ? 'بهینه‌سازی و بازنویسی تمیز' : 'Refactor & Clean Code'}</span>
          </button>
        </div>

        {/* Custom Question Input */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">
            {isFa ? 'پرسش اختصاصی درباره این فایل یا پروژه:' : 'Ask anything about code:'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customQuestion.trim()) {
                  callAiAssistant('custom');
                }
              }}
              placeholder={
                isFa ? 'مثلاً: چگونه یک فرم به این کد اضافه کنم؟' : 'e.g., How do I add dark mode?'
              }
              className="flex-1 bg-slate-900 text-xs px-2.5 py-1.5 rounded border border-slate-800 text-slate-200 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => callAiAssistant('custom')}
              disabled={loading || !customQuestion.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white p-1.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-3">
            <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
            <span>{isFa ? 'در حال تحلیل کد توسط Gemini...' : 'Gemini AI is analyzing code...'}</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Response Box */}
        {response && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs leading-relaxed text-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {isFa ? 'پاسخ هوش مصنوعی:' : 'AI Result:'}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                  title={isFa ? 'کپی پاسخ' : 'Copy'}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                {activeFile && (
                  <button
                    onClick={handleApplyToEditor}
                    className="flex items-center gap-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-[10px] px-2 py-0.5 rounded transition-colors"
                    title={isFa ? 'اعمال کد در ویرایشگر' : 'Apply Code to Active File'}
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{isFa ? 'اعمال به ویرایشگر' : 'Apply Code'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="whitespace-pre-wrap font-sans text-slate-300 text-[12px] overflow-x-auto">
              {response}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
