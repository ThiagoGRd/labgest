export function mergeMessages<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const merged = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) merged.set(message.id, message)
  return [...merged.values()]
}
