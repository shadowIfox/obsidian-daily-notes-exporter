// utils/html.ts — экранирование пользовательского текста перед вставкой через innerHTML

const ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
