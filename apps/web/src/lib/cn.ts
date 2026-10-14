/** Joins class names, skipping falsy values. Tailwind v4 has no class conflicts to merge. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
