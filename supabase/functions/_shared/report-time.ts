// Presentation only: persisted values, query bounds and exports retain precision.
export function reportTime(value: unknown) {
  return String(value ?? '').replace(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\.\d+(?=Z|[+-]\d{2}(?::?\d{2})?)/g, '$1');
}
