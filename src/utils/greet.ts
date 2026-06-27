export function greet(name: string | null): string {
  if (name === null || name === "") {
    return "Hello, Guest!";
  }
  return `Hello, ${name}!`;
}
