import { z } from "zod";
import { getClient } from "../services/notion.js";
import { register } from "./registry.js";
import { toErrorEnvelope } from "../utils/error.js";
import { slimComment, slimList } from "../utils/slim.js";

const VERBOSE = z.boolean().optional();

function plainTextRich(text: string) {
  return [{ type: "text" as const, text: { content: text } }];
}

// ──────────────────────────────────────────────────────────────────────────
// list_comments
// ──────────────────────────────────────────────────────────────────────────

const ListCommentsParams = z.object({
  block_id: z.string().describe("Page or block ID to list comments from."),
  start_cursor: z.string().optional(),
  page_size: z.number().min(1).max(100).optional(),
  verbose: VERBOSE,
});

register({
  name: "list_comments",
  description: "List comments on a page or block.",
  batchable: false,
  schema: ListCommentsParams,
  example: { block_id: "<page-id>" },
  handler: async ({ block_id, start_cursor, page_size, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.comments.list({
        block_id,
        start_cursor,
        page_size: page_size ?? 50,
      });
      return {
        ok: true,
        data: slimList(response, slimComment, verbose ?? false),
      };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// add_page_comment
// ──────────────────────────────────────────────────────────────────────────

const AddPageCommentParams = z.object({
  page_id: z.string(),
  text: z.string().describe("Plain-text comment body."),
  verbose: VERBOSE,
});

register({
  name: "add_page_comment",
  description: "Add a top-level comment to a page.",
  batchable: true,
  schema: AddPageCommentParams,
  example: { page_id: "<page-id>", text: "Looks good to me." },
  exampleBatch: {
    items: [
      { page_id: "<page-id>", text: "First note." },
      { page_id: "<page-id>", text: "Second note." },
    ],
  },
  handler: async ({ page_id, text, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.comments.create({
        parent: { page_id },
        rich_text: plainTextRich(text),
      });
      return { ok: true, data: slimComment(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// add_discussion_comment
// ──────────────────────────────────────────────────────────────────────────

const AddDiscussionCommentParams = z.object({
  discussion_id: z.string(),
  text: z.string(),
  verbose: VERBOSE,
});

register({
  name: "add_discussion_comment",
  description: "Reply to an existing discussion thread.",
  batchable: true,
  schema: AddDiscussionCommentParams,
  example: { discussion_id: "<discussion-id>", text: "Thanks for the heads-up." },
  handler: async ({ discussion_id, text, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.comments.create({
        discussion_id,
        rich_text: plainTextRich(text),
      } as never);
      return { ok: true, data: slimComment(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});
