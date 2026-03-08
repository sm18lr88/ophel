/**
 * Format word count number based on locale
 * @param count - The number to format
 * @param locale - The locale string
 * @returns Formatted string
 */
export function formatWordCount(count: number, locale: string): string {
  if (count < 1000) {
    return count.toString()
  }

  void locale

  if (count >= 1000) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "m"
    }
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k"
  }

  return count.toString()
}
