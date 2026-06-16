export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

export function generateSeed(): number {
  return Math.floor(Math.random() * 100000);
}
