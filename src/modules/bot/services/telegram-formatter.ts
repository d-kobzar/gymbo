/**
 * Defensive converter: take whatever the AI returns (Markdown,
 * mixed, or already-HTML) and produce a string that renders
 * correctly with parse_mode=HTML in Telegram.
 *
 * The AI is instructed to emit Telegram HTML only, but models drift.
 * This runs unconditionally so a ###-laden Markdown response still
 * shows up bolded instead of raw.
 *
 * Whitelist of tags Telegram accepts with parse_mode=HTML:
 *   b, strong, i, em, u, ins, s, strike, del, code, pre, a,
 *   tg-spoiler, blockquote. Anything else we strip.
 *
 * Conversion order matters:
 *   1. Protect fenced code + inline code so their contents survive
 *      untouched through the text substitutions.
 *   2. ### headings → <b>heading</b>.
 *   3. **bold** / __bold__ → <b>.
 *   4. *italic* / _italic_ → <i> (single-delimiter, only around a word,
 *      after bolds are consumed so stray `*` won't collide).
 *   5. [text](url) → <a>.
 *   6. "- " / "* " line prefixes → "• ".
 *   7. Restore protected code.
 *   8. Strip any surviving tag that's not in the Telegram whitelist.
 */

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'code',
  'pre',
  'a',
  'tg-spoiler',
  'blockquote',
]);

const CODE_PLACEHOLDER = '\u0000CODE\u0000';

export function toTelegramHtml(input: string): string {
  if (!input) return input;

  let text = input;
  const stash: string[] = [];

  // 1. Fenced code blocks ```...```
  text = text.replace(/```(\w+\n)?([\s\S]*?)```/g, (_m, _lang, body) => {
    const i = stash.length;
    stash.push(`<pre>${escapeHtmlBody(body.replace(/^\n/, '').replace(/\n$/, ''))}</pre>`);
    return `${CODE_PLACEHOLDER}${i}${CODE_PLACEHOLDER}`;
  });

  // 1b. Inline code `...`
  text = text.replace(/`([^`\n]+)`/g, (_m, body) => {
    const i = stash.length;
    stash.push(`<code>${escapeHtmlBody(body)}</code>`);
    return `${CODE_PLACEHOLDER}${i}${CODE_PLACEHOLDER}`;
  });

  // 2. Headings: "# ...", "## ...", up to "######"
  text = text.replace(/^\s*#{1,6}\s+(.+?)\s*$/gm, '<b>$1</b>');

  // 3. Bold: **text** and __text__ (non-greedy, single-line only)
  text = text.replace(/\*\*([^\n*]+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__([^\n_]+?)__/g, '<b>$1</b>');

  // 4. Italic: *text* and _text_ — single delimiter, avoid chewing
  //    word-internal underscores (e.g. snake_case). Require a
  //    non-word boundary before and after.
  text = text.replace(
    /(^|[\s(\[{>,.!?;:"'«—])\*([^\n*]+?)\*(?=$|[\s)\]},.!?;:"'»—])/g,
    '$1<i>$2</i>',
  );
  text = text.replace(
    /(^|[\s(\[{>,.!?;:"'«—])_([^\n_]+?)_(?=$|[\s)\]},.!?;:"'»—])/g,
    '$1<i>$2</i>',
  );

  // 5. Links [text](url)
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeAttr(url)}">${label}</a>`;
  });

  // 6. Bullet lines: "- " or "* " at start of a trimmed line → "• "
  text = text.replace(/^([ \t]*)[-*][ \t]+/gm, '$1• ');

  // 7. Restore protected code spans
  text = text.replace(/\u0000CODE\u0000(\d+)\u0000CODE\u0000/g, (_m, i) =>
    stash[Number(i)] ?? '',
  );

  // 8. Strip disallowed tags (keep attributes only on <a>).
  text = text.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g, (match, tag, attrs) => {
    const lower = String(tag).toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) return '';
    if (lower === 'a' && match.startsWith('<a')) {
      const href = /href\s*=\s*"([^"]+)"/i.exec(String(attrs ?? ''))?.[1];
      return href ? `<a href="${escapeAttr(href)}">` : '<a>';
    }
    // Other allowed tags: emit without attributes.
    return match.startsWith('</') ? `</${lower}>` : `<${lower}>`;
  });

  return text;
}

function escapeHtmlBody(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
