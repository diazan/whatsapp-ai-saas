export function parseDate(text) {
  const [day, month, year] = text.split("/")

  if (!day || !month || !year) return null

  const date = new Date(`${year}-${month}-${day}T00:00:00`)

  if (isNaN(date.getTime())) return null

  return date
}