export function markdownATextoPlano(valor: string): string {
  return valor
    .replace(/\r\n?/g, '\n')
    .replace(/```(?:[\w+-]+)?\n?/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
