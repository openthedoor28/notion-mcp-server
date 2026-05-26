import { Client } from "@notionhq/client";
import { authProvider } from "./auth.js";

export function getApiToken(): string {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("Error: NOTION_TOKEN environment variable is required");
    process.exit(1);
  }
  return token;
}

export function getRootPageId(): string {
  const pageId = process.env.NOTION_PAGE_ID;
  if (!pageId) {
    console.error("Error: NOTION_PAGE_ID environment variable is required");
    process.exit(1);
  }
  return pageId;
}

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

let cachedClient: Client | null = null;
let cachedToken: string | null = null;

export async function getClient(): Promise<Client> {
  const token = await authProvider.getToken();
  if (token !== cachedToken || cachedClient === null) {
    const fresh = new Client({ auth: token });
    cachedClient = fresh;
    cachedToken = token;
    return fresh;
  }
  return cachedClient;
}
