/**
 * Verifies patched markdown-it (root package.json overrides) parses legal-style
 * markdown the same way react-native-markdown-display expects (MarkdownIt + typographer).
 */
import { MarkdownIt } from 'react-native-markdown-display';

const md = MarkdownIt({ typographer: true });

/** Mirror LegalDocumentSheet.prepareRtlMarkdown — keep in sync when that helper changes. */
function prepareRtlMarkdown(source: string): string {
    return source.replace(/^(#{1,6})\s+(\d+)\.\s+(.+)$/gm, '$1 $3 ‏($2)');
}

type MdToken = { type: string; children?: MdToken[] };

function tokenTypes(markdown: string): string[] {
    const walk = (tokens: MdToken[]): string[] =>
        tokens.flatMap((t) => [t.type, ...(t.children ? walk(t.children) : [])]);
    return walk(md.parse(markdown, {}) as MdToken[]);
}

describe('legal markdown parsing (patched markdown-it)', () => {
    it('parses typical legal structure: headings, link, bullet list', () => {
        const types = tokenTypes(
            '# Terms\n\nSee [our site](https://example.com).\n\n- One\n- Two',
        );
        expect(types).toContain('heading_open');
        expect(types).toContain('link_open');
        expect(types).toContain('bullet_list_open');
    });

    it('parses Hebrew RTL content after numbered-heading rewrite', () => {
        const raw = '## 10. תנאים\n\nטקסט משפטי בעברית.';
        const prepared = prepareRtlMarkdown(raw);
        expect(prepared).toMatch(/## תנאים/);
        expect(prepared).toMatch(/\(10\)/);
        expect(() => md.parse(prepared, {})).not.toThrow();
        const types = tokenTypes(prepared);
        expect(types).toContain('heading_open');
        expect(types).toContain('paragraph_open');
    });

    it('parses Arabic RTL content with links and ordered lists', () => {
        const ar = '## 3. الخصوصية\n\n[موقعنا](https://example.com)\n\n1. أول\n2. ثان';
        const prepared = prepareRtlMarkdown(ar);
        expect(() => md.parse(prepared, {})).not.toThrow();
        const types = tokenTypes(prepared);
        expect(types).toContain('ordered_list_open');
        expect(types).toContain('link_open');
    });
});
