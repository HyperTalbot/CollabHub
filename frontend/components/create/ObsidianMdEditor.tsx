// frontend/components/create/ObsidianMdEditor.tsx
"use client";

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import {
  EditorView, Decoration, DecorationSet, WidgetType, ViewPlugin, ViewUpdate,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { RangeSet, Range } from '@codemirror/state';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Quote, List, ListOrdered,
  Minus, Link2, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { getMediaURL, getMediaKind } from '@/lib/mediaUtils';
import { uploadImage, uploadVideo } from '@/services/uploadService';

export interface ObsidianMdEditorHandle {
  insertAtCaret: (snippet: string) => void;
}

interface ObsidianMdEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  dark?: boolean;
  allowImages?: boolean; // разрешена ли вставка медиа в текст (выключено для reddit)
}

interface Token {
  type: 'text' | 'bold' | 'italic' | 'strike' | 'code' | 'image' | 'link' | 'heading' | 'quote' | 'hr';
  raw: string; start: number; pre: number; suf: number;
  level?: number; url?: string; alt?: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let rest = line; let abs = 0;
  let m = rest.match(/^(#{1,6})\s+/);
  if (m) {
    tokens.push({ type: 'heading', raw: m[0], start: abs, pre: m[0].length, suf: 0, level: m[1].length });
    rest = rest.slice(m[0].length); abs += m[0].length;
  } else if ((m = rest.match(/^>\s?/))) {
    tokens.push({ type: 'quote', raw: m[0], start: abs, pre: m[0].length, suf: 0 });
    rest = rest.slice(m[0].length); abs += m[0].length;
  } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(rest) && rest.trim() !== '') {
    tokens.push({ type: 'hr', raw: line, start: 0, pre: 0, suf: 0 });
    return tokens;
  }
  const re = /(!\[[^\]]*\]\([^)\s]*\))|(\[[^\]]+\]\([^)\s]*\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(`[^`]+`)/g;
  let last = 0; let mm: RegExpExecArray | null;
  while ((mm = re.exec(rest)) !== null) {
    if (mm.index > last) tokens.push({ type: 'text', raw: rest.slice(last, mm.index), start: abs + last, pre: 0, suf: 0 });
    const raw = mm[0]; const st = abs + mm.index;
    if (mm[1]) {
      const im = raw.match(/^!\[([^\]]*)\]\(([^)\s]*)\)$/);
      tokens.push({ type: 'image', raw, start: st, pre: 0, suf: 0, alt: im?.[1] || '', url: im?.[2] || '' });
    } else if (mm[2]) {
      const lm = raw.match(/^\[([^\]]+)\]\([^)\s]*\)$/);
      const txt = lm?.[1] || '';
      tokens.push({ type: 'link', raw, start: st, pre: 1, suf: raw.length - 1 - txt.length, url: lm?.[2] || '', alt: txt });
    } else if (mm[3]) tokens.push({ type: 'bold', raw, start: st, pre: 2, suf: 2 });
    else if (mm[4]) tokens.push({ type: 'italic', raw, start: st, pre: 1, suf: 1 });
    else if (mm[5]) tokens.push({ type: 'strike', raw, start: st, pre: 2, suf: 2 });
    else if (mm[6]) tokens.push({ type: 'code', raw, start: st, pre: 1, suf: 1 });
    last = mm.index + raw.length;
  }
  if (last < rest.length) tokens.push({ type: 'text', raw: rest.slice(last), start: abs + last, pre: 0, suf: 0 });
  return tokens;
}

const markClass = (t: Token): string => {
  switch (t.type) {
    case 'bold': return 'font-bold text-gray-900 dark:text-white';
    case 'italic': return 'italic';
    case 'strike': return 'line-through text-gray-500 dark:text-gray-400';
    case 'code': return 'px-1 rounded bg-gray-200 dark:bg-gray-700 text-rose-600 dark:text-rose-300';
    case 'link': return 'text-indigo-600 dark:text-indigo-400 underline';
    case 'quote': return 'italic text-gray-600 dark:text-gray-300';
    case 'heading': {
      const cls = ['text-2xl font-extrabold', 'text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-semibold'][(t.level || 1) - 1];
      return `${cls} text-gray-900 dark:text-white`;
    }
    default: return '';
  }
};

// НОВОЕ: виджет МЕДИА (картинка / gif с бейджем / видео с проигрывателем).
// draggable — для перемещения по тексту (drag-and-drop).
class MediaWidget extends WidgetType {
  constructor(readonly url: string, readonly alt: string, readonly pos: number, readonly len: number) { super(); }
  eq(o: MediaWidget) { return o.url === this.url && o.pos === this.pos && o.len === this.len; }
  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'inline-block align-middle cursor-grab my-1 relative';
    wrap.draggable = true;
    wrap.dataset.imgPos = String(this.pos);
    wrap.dataset.imgLen = String(this.len);
    const kind = getMediaKind(this.url);
    const src = getMediaURL(this.url);

    if (kind === 'video') {
      // Видео: простой html-проигрыватель
      const v = document.createElement('video');
      v.src = src;
      v.controls = true;
      v.preload = 'metadata';
      v.className = 'max-h-44 w-auto max-w-full rounded-lg border border-gray-200 dark:border-gray-600 inline-block bg-black shadow-sm';
      wrap.appendChild(v);
    } else {
      // Картинка / gif (gif анимируется сам, проигрыватель не нужен)
      const img = document.createElement('img');
      img.src = src;
      img.alt = this.alt;
      img.className = 'max-h-44 rounded-lg border border-gray-200 dark:border-gray-600 inline-block select-none pointer-events-none shadow-sm';
      wrap.appendChild(img);
      if (kind === 'gif') {
        const b = document.createElement('span');
        b.textContent = 'GIF';
        b.className = 'absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white bg-black/70 rounded border border-white/40 shadow pointer-events-none select-none';
        wrap.appendChild(b);
      }
    }
    return wrap;
  }
  ignoreEvent() { return false; }
}

class HrWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'block h-px bg-gray-300 dark:bg-gray-600 my-3';
    return el;
  }
}

// Плагин скрытия markdown-синтаксиса ВНЕ зоны курсора
const hideSyntaxPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = this.build(view); }
  update(u: ViewUpdate) {
    if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = this.build(u.view);
  }
  build(view: EditorView): DecorationSet {
    const ranges: Range<Decoration>[] = [];
    const head = view.state.selection.main.head;
    for (const { from, to } of view.visibleRanges) {
      const startLine = view.state.doc.lineAt(from).number;
      const endLine = view.state.doc.lineAt(to).number;
      for (let n = startLine; n <= endLine; n++) {
        const line = view.state.doc.line(n);
        for (const t of tokenizeLine(line.text)) {
          const a = line.from + t.start;
          const b = a + t.raw.length;
          if (head >= a && head <= b) continue; // зона курсора -> сырой markdown
          if (t.type === 'image') {
            ranges.push(Decoration.replace({ widget: new MediaWidget(t.url || '', t.alt || '', a, t.raw.length) }).range(a, b));
            continue;
          }
          if (t.type === 'hr') {
            ranges.push(Decoration.replace({ widget: new HrWidget() }).range(a, b));
            continue;
          }
          if (t.pre > 0) ranges.push(Decoration.replace({}).range(a, a + t.pre));
          if (t.suf > 0) ranges.push(Decoration.replace({}).range(b - t.suf, b));
          const cls = markClass(t);
          if (cls && b - t.suf > a + t.pre) ranges.push(Decoration.mark({ class: cls }).range(a + t.pre, b - t.suf));
        }
      }
    }
    ranges.sort((x, y) => x.from - y.from);
    return RangeSet.of(ranges);
  }
}, { decorations: (v) => v.decorations });

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '15px' },
  '.cm-content': { minHeight: '200px', caretColor: '#6366f1' },
  '.cm-line': { padding: '0 4px' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-placeholder': { color: '#9ca3af' },
});

const ObsidianMdEditor = forwardRef<ObsidianMdEditorHandle, ObsidianMdEditorProps>(
  function ObsidianMdEditor({ value, onChange, placeholder, minHeight = 220, dark = false, allowImages = true }, ref) {
    const viewRef = useRef<EditorView | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const dragRef = useRef<{ pos: number; len: number; raw: string } | null>(null);
    const [uploading, setUploading] = React.useState(false);

    const extensions = useMemo(() => [
      markdown(),
      hideSyntaxPlugin,
      EditorView.lineWrapping,
      baseTheme,
      ...(placeholder ? [cmPlaceholder(placeholder)] : []),
    ], [placeholder]);

    useImperativeHandle(ref, () => ({
      insertAtCaret: (snippet: string) => {
        const v = viewRef.current; if (!v) return;
        const { head } = v.state.selection.main;
        v.dispatch({ changes: { from: head, insert: snippet }, selection: { anchor: head + snippet.length } });
        v.focus();
      },
    }));

    const wrapSel = (marker: string, fallback = 'текст') => {
      const v = viewRef.current; if (!v) return;
      const { from, to } = v.state.selection.main;
      const sel = v.state.sliceDoc(from, to) || fallback;
      v.dispatch({
        changes: { from, to, insert: marker + sel + marker },
        selection: { anchor: from + marker.length, head: from + marker.length + sel.length },
      });
      v.focus();
    };
    const linePrefix = (prefix: string) => {
      const v = viewRef.current; if (!v) return;
      const line = v.state.doc.lineAt(v.state.selection.main.head);
      v.dispatch({ changes: { from: line.from, insert: prefix } });
      v.focus();
    };
    const insertRaw = (text: string) => {
      const v = viewRef.current; if (!v) return;
      const { head } = v.state.selection.main;
      v.dispatch({ changes: { from: head, insert: text }, selection: { anchor: head + text.length } });
      v.focus();
    };
    const insertLink = () => {
      const v = viewRef.current; if (!v) return;
      const { from, to } = v.state.selection.main;
      const sel = v.state.sliceDoc(from, to) || 'текст';
      v.dispatch({ changes: { from, to, insert: `[${sel}](url)` } });
      v.focus();
    };

    // НОВОЕ: загрузка картинки/gif/видео и вставка в место курсора
    const handleMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(true);
      try {
        const url = file.type.startsWith('video/') ? await uploadVideo(file) : await uploadImage(file);
        insertRaw(`\n![${file.name.replace(/\.[^.]+$/, '')}](${url})\n`);
      } finally {
        setUploading(false);
      }
    };

    // ===== DRAG-AND-DROP медиа по тексту =====
    const onDragStart = (e: React.DragEvent) => {
      const el = (e.target as HTMLElement).closest('[data-img-pos]') as HTMLElement | null;
      if (!el) { e.preventDefault(); return; }
      const pos = Number(el.dataset.imgPos);
      const len = Number(el.dataset.imgLen);
      const v = viewRef.current;
      dragRef.current = { pos, len, raw: v ? v.state.sliceDoc(pos, pos + len) : '' };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragRef.current.raw);
    };
    const onDragOver = (e: React.DragEvent) => { if (dragRef.current) e.preventDefault(); };
    const onDrop = (e: React.DragEvent) => {
      const v = viewRef.current;
      const drag = dragRef.current;
      dragRef.current = null;
      if (!v || !drag) return;
      e.preventDefault();
      const at = v.posAtCoords({ x: e.clientX, y: e.clientY });
      if (at == null) return;
      let target = at;
      if (target > drag.pos) target -= drag.len;
      v.dispatch({
        changes: [
          { from: drag.pos, to: drag.pos + drag.len },
          { from: target, insert: drag.raw },
        ],
        selection: { anchor: target + drag.len },
      });
      v.focus();
    };

    const tb = 'p-1.5 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50';

    return (
      <div
        className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-indigo-500 overflow-hidden shadow-sm"
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* ТУЛБАР */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
          <button type="button" className={tb} title="Жирный (**текст**)" onClick={() => wrapSel('**')}><Bold size={15} /></button>
          <button type="button" className={tb} title="Курсив (*текст*)" onClick={() => wrapSel('*')}><Italic size={15} /></button>
          <button type="button" className={tb} title="Зачёркнутый (~~текст~~)" onClick={() => wrapSel('~~')}><Strikethrough size={15} /></button>
          <button type="button" className={tb} title="Код (`код`)" onClick={() => wrapSel('`', 'код')}><Code size={15} /></button>
          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button type="button" className={tb} title="Заголовок 1" onClick={() => linePrefix('# ')}><Heading1 size={15} /></button>
          <button type="button" className={tb} title="Заголовок 2" onClick={() => linePrefix('## ')}><Heading2 size={15} /></button>
          <button type="button" className={tb} title="Цитата" onClick={() => linePrefix('> ')}><Quote size={15} /></button>
          <span className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button type="button" className={tb} title="Список" onClick={() => linePrefix('- ')}><List size={15} /></button>
          <button type="button" className={tb} title="Нумерованный список" onClick={() => linePrefix('1. ')}><ListOrdered size={15} /></button>
          <button type="button" className={tb} title="Разделитель" onClick={() => insertRaw('\n---\n')}><Minus size={15} /></button>
          <button type="button" className={tb} title="Ссылка" onClick={insertLink}><Link2 size={15} /></button>
          {allowImages && (
            <button type="button" className={tb} title="Загрузить изображение / gif / видео" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
            </button>
          )}
        </div>

        <CodeMirror
          value={value}
          onChange={(v) => onChange(v)}
          extensions={extensions}
          theme={dark ? 'dark' : 'light'}
          height={`${minHeight}px`}
          basicSetup={{ foldGutter: false, autocompletion: false, highlightActiveLine: false }}
          onCreateEditor={(view) => { viewRef.current = view; }}
        />

        {allowImages && (
          // НОВОЕ: accept включает видео
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaFile} />
        )}
      </div>
    );
  }
);

export default ObsidianMdEditor;