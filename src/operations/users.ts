import { z } from "zod";
import { getClient } from "../services/notion.js";
import { register } from "./registry.js";
import { toErrorEnvelope } from "../utils/error.js";
import { slimUser, slimList } from "../utils/slim.js";

const VERBOSE = z.boolean().optional();

// ──────────────────────────────────────────────────────────────────────────
// list_users
// ──────────────────────────────────────────────────────────────────────────

const ListUsersParams = z.object({
  start_cursor: z.string().optional(),
  page_size: z.number().min(1).max(100).optional(),
  verbose: VERBOSE,
});

register({
  name: "list_users",
  description: "List all users in the workspace. Requires the integration to have 'Read user information' capability enabled.",
  batchable: false,
  schema: ListUsersParams,
  example: { page_size: 50 },
  handler: async ({ start_cursor, page_size, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.users.list({
        start_cursor,
        page_size: page_size ?? 50,
      });
      return {
        ok: true,
        data: slimList(response, slimUser, verbose ?? false),
      };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// get_user
// ──────────────────────────────────────────────────────────────────────────

const GetUserParams = z.object({ user_id: z.string(), verbose: VERBOSE });

register({
  name: "get_user",
  description: "Get one user by ID. Requires 'Read user information' capability.",
  batchable: true,
  schema: GetUserParams,
  example: { user_id: "<user-id>" },
  handler: async ({ user_id, verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.users.retrieve({ user_id });
      return { ok: true, data: slimUser(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// get_bot_user
// ──────────────────────────────────────────────────────────────────────────

const GetBotUserParams = z.object({ verbose: VERBOSE });

register({
  name: "get_bot_user",
  description: "Get the integration's bot user. Always works without extra capabilities.",
  batchable: false,
  schema: GetBotUserParams,
  example: {},
  handler: async ({ verbose }) => {
    try {
      const notion = await getClient();
      const response = await notion.users.me({});
      return { ok: true, data: slimUser(response, verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});
