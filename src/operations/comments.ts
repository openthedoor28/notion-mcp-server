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

const AddPageCommentParams = z
  .object({
    page_id: z.string(),
    text: z.string().optional().describe("Plain-text comment body."),
    markdown: z.string().optional().describe("Comment body as markdown. Mutually exclusive with text."),
    verbose: VERBOSE,
  })
  .refine((v) => Boolean(v.text) !== Boolean(v.markdown), {
    message: "Pass exactly one of `text` or `markdown`.",
  });

register({
  name: "add_page_comment",
  description: "Add a top-level comment to a page. Body can be plain text or markdown.",
  batchable: true,
  schema: AddPageCommentParams,
  example: { page_id: "<page-id>", text: "Looks good to me." },
  exampleBatch: {
    items: [
      { page_id: "<page-id>", text: "First note." },
      { page_id: "<page-id>", markdown: "**Second** note." },
    ],
  },
  handler: async ({ page_id, text, markdown, verbose }) => {
    try {
      const notion = await getClient();
      const body = markdown !== undefined ? { markdown } : { rich_text: plainTextRich(text!) };
      const response = await notion.comments.create({
        parent: { page_id },
        ...body,
      } as never);
      return { ok: true, data: slimComment(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// add_discussion_comment
// ──────────────────────────────────────────────────────────────────────────

const AddDiscussionCommentParams = z
  .object({
    discussion_id: z.string(),
    text: z.string().optional(),
    markdown: z.string().optional().describe("Comment body as markdown. Mutually exclusive with text."),
    verbose: VERBOSE,
  })
  .refine((v) => Boolean(v.text) !== Boolean(v.markdown), {
    message: "Pass exactly one of `text` or `markdown`.",
  });

register({
  name: "add_discussion_comment",
  description: "Reply to an existing discussion thread. Body can be plain text or markdown.",
  batchable: true,
  schema: AddDiscussionCommentParams,
  example: { discussion_id: "<discussion-id>", text: "Thanks for the heads-up." },
  handler: async ({ discussion_id, text, markdown, verbose }) => {
    try {
      const notion = await getClient();
      const body = markdown !== undefined ? { markdown } : { rich_text: plainTextRich(text!) };
      const response = await notion.comments.create({
        discussion_id,
        ...body,
      } as never);
      return { ok: true, data: slimComment(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// get_comment
// ──────────────────────────────────────────────────────────────────────────

const GetCommentParams = z.object({
  comment_id: z.string(),
  verbose: VERBOSE,
});

register({
  name: "get_comment",
  description: "Retrieve a single comment by ID.",
  batchable: true,
  schema: GetCommentParams,
  example: { comment_id: "<comment-id>" },
  handler: async ({ comment_id, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.comments.retrieve({ comment_id });
      return {
        ok: true,
        data: verbose
          ? response
          : {
              id: (response as { id: string }).id,
              created_time: (response as { created_time?: string }).created_time,
            },
      };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// update_comment
// ──────────────────────────────────────────────────────────────────────────

const UpdateCommentParams = z
  .object({
    comment_id: z.string(),
    rich_text: z.array(z.unknown()).optional(),
    markdown: z.string().optional(),
    verbose: VERBOSE,
  })
  .refine((v) => Boolean(v.rich_text) !== Boolean(v.markdown), {
    message: "Pass exactly one of `rich_text` or `markdown`.",
  });

register({
  name: "update_comment",
  description: "Replace a comment's body. Pass markdown or rich_text (not both).",
  batchable: true,
  schema: UpdateCommentParams,
  example: { comment_id: "<comment-id>", markdown: "Updated body" },
  handler: async ({ comment_id, rich_text, markdown, verbose }) => {
    try {
      const notion = await getClient();
      const body = markdown !== undefined ? { markdown } : { rich_text };
      const response = await notion.comments.update({ comment_id, ...body } as never);
      return { ok: true, data: verbose ? response : { id: (response as { id: string }).id } };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// delete_comment
// ──────────────────────────────────────────────────────────────────────────

const DeleteCommentParams = z.object({
  comment_id: z.string(),
});

register({
  name: "delete_comment",
  description: "Delete a comment.",
  batchable: true,
  schema: DeleteCommentParams,
  example: { comment_id: "<comment-id>" },
  handler: async ({ comment_id }) => {
    try {
      const notion = await getClient();
      await notion.comments.delete({ comment_id });
      return { ok: true, data: { deleted: comment_id } };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});
