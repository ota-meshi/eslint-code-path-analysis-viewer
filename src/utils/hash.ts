import { decompress } from "./compress";

export async function toCode(hashData: string): Promise<string | null> {
  const queryParam = decompress(hashData);
  if (queryParam) {
    return queryParam as unknown as string;
  }
  return Promise.resolve(null);
}

export function getHashData(): string {
  return window.location.hash.slice(window.location.hash.indexOf("#") + 1);
}
