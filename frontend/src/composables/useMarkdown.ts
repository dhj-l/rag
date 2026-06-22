import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

/**
 * Markdown 渲染组合式函数（§6.1 markdown-it + highlight.js）
 *
 * 助手消息按 Markdown 渲染并高亮代码块。单例 md 实例，供 MessageBubble 复用。
 */
let mdInstance: MarkdownIt | null = null;

function getMd(): MarkdownIt {
  if (mdInstance) return mdInstance;
  mdInstance = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    highlight(str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`;
        } catch {
          // fall through
        }
      }
      return `<pre><code class="hljs">${mdInstance!.utils.escapeHtml(str)}</code></pre>`;
    },
  });
  return mdInstance;
}

export function useMarkdown() {
  const md = getMd();
  return {
    render: (src: string): string => md.render(src ?? ''),
  };
}
