// frontend/components/shared/MarkdownRenderer.tsx  (НОВЫЙ ФАЙЛ)
// Рендер Markdown с ЯВНЫМИ стилями (не зависит от @tailwindcss/typography,
// который в Tailwind v4 не подхватывается из tailwind.config.ts).
"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';       // ~~зачёркнутый~~, таблицы, автоссылки
import remarkBreaks from 'remark-breaks'; // одиночные переносы = <br/>
import { getMediaURL } from '@/lib/mediaUtils';

interface MarkdownRendererProps {
  content: string;
  compact?: boolean; // для ленты — чуть мельче
  stopLinks?: boolean; // не переходить по ссылкам/картинкам при клике по карточке
}

export default function MarkdownRenderer({ content, compact = false, stopLinks = false }: MarkdownRendererProps) {
  const stop = (e: React.MouseEvent) => { if (stopLinks) e.stopPropagation(); };

  const components: any = {
    h1: ({ children }: any) => <h1 onClick={stop} className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 mt-5 mb-3 leading-tight">{children}</h1>,
    h2: ({ children }: any) => <h2 onClick={stop} className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-4 mb-2 leading-tight">{children}</h2>,
    h3: ({ children }: any) => <h3 onClick={stop} className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-4 mb-2">{children}</h3>,
    h4: ({ children }: any) => <h4 onClick={stop} className="text-lg font-semibold text-gray-900 dark:text-gray-50 mt-3 mb-2">{children}</h4>,
    h5: ({ children }: any) => <h5 onClick={stop} className="text-base font-semibold text-gray-900 dark:text-gray-50 mt-2 mb-1">{children}</h5>,
    h6: ({ children }: any) => <h6 onClick={stop} className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300 mt-2 mb-1">{children}</h6>,
    p: ({ children }: any) => <p className={`my-2 leading-relaxed ${compact ? 'text-base' : 'text-lg'}`}>{children}</p>,
    blockquote: ({ children }: any) => (
      <blockquote onClick={stop} className="border-l-4 border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/25 pl-4 pr-3 py-2 my-3 italic text-gray-700 dark:text-gray-300 rounded-r-lg">
        {children}
      </blockquote>
    ),
    ul: ({ children }: any) => <ul onClick={stop} className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol onClick={stop} className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="my-0.5 leading-relaxed">{children}</li>,
    pre: ({ children }: any) => <pre onClick={stop} className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 my-3 overflow-x-auto text-sm leading-relaxed">{children}</pre>,
    code: ({ children }: any) => <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-rose-600 dark:text-rose-300 text-[0.9em]">{children}</code>,
    a: ({ href, children }: any) => (
      <a href={href} onClick={(e: React.MouseEvent) => { stop(e); }} className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300">{children}</a>
    ),
    img: ({ src, alt }: any) => (
      <img onClick={stop} src={getMediaURL(src as string)} alt={alt || ''} loading="lazy"
        className="rounded-xl max-h-[520px] object-contain my-3 mx-auto border border-gray-200 dark:border-gray-700 shadow-sm" />
    ),
    hr: () => <hr className="my-5 border-t border-gray-300 dark:border-gray-600" />,
    strong: ({ children }: any) => <strong className="font-bold text-gray-900 dark:text-white">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
    del: ({ children }: any) => <del className="line-through text-gray-500 dark:text-gray-400">{children}</del>,
    table: ({ children }: any) => <table onClick={stop} className="min-w-full border-collapse my-3 text-base">{children}</table>,
    th: ({ children }: any) => <th className="border border-gray-300 dark:border-gray-600 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-left font-semibold">{children}</th>,
    td: ({ children }: any) => <td className="border border-gray-300 dark:border-gray-600 px-3 py-1.5">{children}</td>,
  };

  return (
    <div className={`md-render break-words text-gray-800 dark:text-gray-200 ${compact ? 'text-base' : 'text-lg'}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content ?? ''}
      </ReactMarkdown>
    </div>
  );
}