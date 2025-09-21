
export function formatCurrency(n?: number, locale: string = 'pt-BR') {
  const result = n == null
    ? '' // or '—'
    : new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(n);
  return result;
}

export function parseBool(envVar?: string): boolean {
  return envVar?.toLowerCase() === "true";
}
