import { z } from "zod";
import { getClient } from "../services/notion.js";
import { register } from "./registry.js";
import { toErrorEnvelope } from "../utils/error.js";
import { slimDatabase, slimList, slimPage } from "../utils/slim.js";
import { DATABASE_PROPERTY_SCHEMA } from "../schema/database.js";
import { PARENT_SCHEMA } from "../schema/page.js";
import { ICON_SCHEMA } from "../schema/icon.js";
import { FILE_SCHEMA } from "../schema/file.js";
import { TEXT_RICH_TEXT_ITEM_REQUEST_SCHEMA } from "../schema/rich-text.js";

const VERBOSE = z.boolean().optional();

// ──────────────────────────────────────────────────────────────────────────
// create_database
// ──────────────────────────────────────────────────────────────────────────

const CreateDatabaseParams = z.object({
  parent: PARENT_SCHEMA.optional(),
  title: z.string().optional().describe("Plain-text title shortcut."),
  title_rich: z.array(TEXT_RICH_TEXT_ITEM_REQUEST_SCHEMA).optional().describe("Rich-text title; overrides `title`."),
  description: z.array(TEXT_RICH_TEXT_ITEM_REQUEST_SCHEMA).optional(),
  properties: z.record(z.string(), DATABASE_PROPERTY_SCHEMA),
  is_inline: z.boolean().optional(),
  icon: ICON_SCHEMA.nullable().optional(),
  cover: FILE_SCHEMA.nullable().optional(),
  verbose: VERBOSE,
});

function resolveParent(parent: z.infer<typeof PARENT_SCHEMA> | undefined) {
  if (parent) return parent;
  const envId = process.env.NOTION_PAGE_ID;
  if (envId) return { type: "page_id" as const, page_id: envId };
  return undefined;
}

register({
  name: "create_database",
  description: "Create a new database. Properties is a map of name → property-type definition.",
  batchable: true,
  schema: CreateDatabaseParams,
  example: {
    title: "Tasks",
    properties: {
      Name: { type: "title", title: {} },
      Status: {
        type: "select",
        select: {
          options: [
            { name: "Open", color: "blue" },
            { name: "Done", color: "green" },
          ],
        },
      },
    },
  },
  rollback: async (data) => {
    if (typeof data !== "object" || data === null) return;
    const id = (data as { id?: string }).id;
    if (!id) return;
    const notion = await getClient();
    await notion.databases.update({ database_id: id, archived: true } as never);
  },
  handler: async (params) => {
    try {
      const parent = resolveParent(params.parent);
      if (!parent) {
        return {
          ok: false,
          error: {
            code: "missing_parent",
            message: "No parent specified and NOTION_PAGE_ID is not set.",
            fix: "Pass `parent: {type:'page_id', page_id:'...'}` or set NOTION_PAGE_ID in the environment.",
          },
        };
      }
      const titleRich = params.title_rich
        ? params.title_rich
        : params.title
          ? [{ type: "text" as const, text: { content: params.title } }]
          : [];
      const notion = await getClient();
      const response = await notion.databases.create({
        parent: parent as never,
        title: titleRich as never,
        ...(params.description ? { description: params.description as never } : {}),
        properties: params.properties as never,
        is_inline: params.is_inline ?? false,
        ...(params.icon !== undefined ? { icon: params.icon as never } : {}),
        ...(params.cover !== undefined ? { cover: params.cover as never } : {}),
      } as never);
      return { ok: true, data: slimDatabase(response, params.verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// query_database
// ──────────────────────────────────────────────────────────────────────────

const QueryDatabaseParams = z.object({
  database_id: z.string(),
  filter: z.unknown().optional().describe(
    "Notion filter object. See https://developers.notion.com/reference/post-database-query-filter. Example: {property: 'Status', status: {equals: 'Done'}}"
  ),
  sorts: z
    .array(
      z.union([
        z.object({
          property: z.string(),
          direction: z.enum(["ascending", "descending"]),
        }),
        z.object({
          timestamp: z.enum(["created_time", "last_edited_time"]),
          direction: z.enum(["ascending", "descending"]),
        }),
      ])
    )
    .optional(),
  page_size: z.number().min(1).max(100).optional(),
  start_cursor: z.string().optional(),
  verbose: VERBOSE,
});

register({
  name: "query_database",
  description: "Query a database with optional filter and sorts. Results are page objects.",
  batchable: false,
  schema: QueryDatabaseParams,
  example: {
    database_id: "<database-id>",
    filter: { property: "Status", status: { equals: "Open" } },
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 25,
  },
  handler: async ({ database_id, filter, sorts, page_size, start_cursor, verbose }) => {
    try {
      const notion = await getClient();
      const response = await (notion.databases as never as { query: (args: unknown) => Promise<never> }).query({
        database_id,
        ...(filter ? { filter: filter as never } : {}),
        ...(sorts ? { sorts: sorts as never } : {}),
        page_size: page_size ?? 25,
        start_cursor,
      });
      return {
        ok: true,
        data: slimList(response, slimPage, verbose ?? false),
      };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// update_database
// ──────────────────────────────────────────────────────────────────────────

const UpdateDatabaseParams = z.object({
  database_id: z.string(),
  title: z.string().optional(),
  title_rich: z.array(TEXT_RICH_TEXT_ITEM_REQUEST_SCHEMA).optional(),
  description: z.array(TEXT_RICH_TEXT_ITEM_REQUEST_SCHEMA).optional(),
  properties: z.record(z.string(), DATABASE_PROPERTY_SCHEMA).optional(),
  is_inline: z.boolean().optional(),
  archived: z.boolean().optional(),
  icon: ICON_SCHEMA.nullable().optional(),
  cover: FILE_SCHEMA.nullable().optional(),
  verbose: VERBOSE,
});

register({
  name: "update_database",
  description: "Update database title, description, properties, archived flag, icon, or cover.",
  batchable: true,
  schema: UpdateDatabaseParams,
  example: {
    database_id: "<database-id>",
    title: "Renamed",
  },
  handler: async (params) => {
    try {
      const titleRich = params.title_rich
        ? params.title_rich
        : params.title !== undefined
          ? [{ type: "text" as const, text: { content: params.title } }]
          : undefined;
      const notion = await getClient();
      const response = await notion.databases.update({
        database_id: params.database_id,
        ...(titleRich ? { title: titleRich as never } : {}),
        ...(params.description ? { description: params.description as never } : {}),
        ...(params.properties ? { properties: params.properties as never } : {}),
        ...(params.is_inline !== undefined ? { is_inline: params.is_inline } : {}),
        ...(params.archived !== undefined ? { archived: params.archived } : {}),
        ...(params.icon !== undefined ? { icon: params.icon as never } : {}),
        ...(params.cover !== undefined ? { cover: params.cover as never } : {}),
      } as never);
      return { ok: true, data: slimDatabase(response, params.verbose ?? false) };
    } catch (error) {
      return { ok: false, error: toErrorEnvelope(error) };
    }
  },
});
