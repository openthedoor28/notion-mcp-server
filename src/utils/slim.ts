import {
  isFullBlock,
  isFullComment,
  isFullDatabase,
  isFullDataSource,
  isFullPage,
  isFullUser,
} from "@notionhq/client";
import type {
  BlockObjectResponse,
  CommentObjectResponse,
  DatabaseObjectResponse,
  DataSourceObjectResponse,
  FileUploadObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  PartialCommentObjectResponse,
  PartialDatabaseObjectResponse,
  PartialDataSourceObjectResponse,
  PartialPageObjectResponse,
  PartialUserObjectResponse,
  RichTextItemResponse,
  UserObjectResponse,
} from "@notionhq/client";

export type PageResponse = PageObjectResponse | PartialPageObjectResponse;
export type BlockResponse = BlockObjectResponse | PartialBlockObjectResponse;
export type DatabaseResponse =
  | DatabaseObjectResponse
  | PartialDatabaseObjectResponse;
export type DataSourceResponse =
  | DataSourceObjectResponse
  | PartialDataSourceObjectResponse;
export type UserResponse = UserObjectResponse | PartialUserObjectResponse;
export type CommentResponse =
  | CommentObjectResponse
  | PartialCommentObjectResponse;

export type SearchItemResponse = PageResponse | DatabaseResponse | DataSourceResponse;

function extractRichText(rich: readonly RichTextItemResponse[]): string {
  return rich.map((r) => r.plain_text).join("");
}

function extractTitle(
  properties: PageObjectResponse["properties"]
): string | undefined {
  for (const value of Object.values(properties)) {
    if (value.type === "title") return extractRichText(value.title);
  }
  return undefined;
}

export function slimPage(page: PageResponse, verbose = false) {
  if (verbose) return page;
  if (!isFullPage(page)) return { id: page.id };
  return {
    id: page.id,
    url: page.url,
    title: extractTitle(page.properties),
    parent: page.parent,
    archived: page.in_trash,
    in_trash: page.in_trash,
    icon: page.icon ? page.icon.type : null,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
  };
}

export function slimBlock(block: BlockResponse, verbose = false) {
  if (verbose) return block;
  if (!isFullBlock(block)) return { id: block.id };

  const base = {
    id: block.id,
    type: block.type,
    text: extractBlockText(block),
    has_children: block.has_children,
    archived: block.in_trash,
    in_trash: block.in_trash,
  };

  if (block.type === "to_do") {
    return { ...base, checked: block.to_do.checked };
  }
  if (block.type === "code") {
    return { ...base, language: block.code.language };
  }
  if (block.type === "image") {
    const img = block.image;
    const url = img.type === "external" ? img.external.url : img.file.url;
    return { ...base, image: url };
  }
  return base;
}

function extractBlockText(block: BlockObjectResponse): string | undefined {
  // Many block subtypes expose a `rich_text` array under their type key.
  // Read it via a structural narrow so we don't have to enumerate every variant.
  const inner = (block as unknown as Record<string, unknown>)[block.type];
  if (typeof inner !== "object" || inner === null) return undefined;
  const richText = (inner as { rich_text?: unknown }).rich_text;
  if (!Array.isArray(richText)) return undefined;
  return extractRichText(richText as RichTextItemResponse[]);
}

export function slimDatabase(db: DatabaseResponse, verbose = false) {
  if (verbose) return db;
  if (!isFullDatabase(db)) return { id: db.id };
  return {
    id: db.id,
    url: db.url,
    title: extractRichText(db.title),
    description: extractRichText(db.description),
    parent: db.parent,
    archived: db.in_trash,
    in_trash: db.in_trash,
    is_inline: db.is_inline,
    is_locked: db.is_locked,
    data_sources: db.data_sources.map((s) => ({ id: s.id, name: s.name })),
    icon: db.icon ? db.icon.type : null,
    created_time: db.created_time,
    last_edited_time: db.last_edited_time,
  };
}

export function slimDataSource(ds: DataSourceResponse, verbose = false) {
  if (verbose) return ds;
  if (!isFullDataSource(ds)) return { id: ds.id };
  return {
    id: ds.id,
    url: ds.url,
    title: extractRichText(ds.title),
    description: extractRichText(ds.description),
    parent: ds.parent,
    properties: Object.keys(ds.properties),
    icon: ds.icon ? ds.icon.type : null,
    archived: ds.in_trash,
    in_trash: ds.in_trash,
    created_time: ds.created_time,
    last_edited_time: ds.last_edited_time,
  };
}

export function slimItem(item: SearchItemResponse, verbose = false) {
  if (verbose) return item;
  if (item.object === "page") return slimPage(item, verbose);
  if (item.object === "database") return slimDatabase(item, verbose);
  return slimDataSource(item, verbose);
}

export function slimUser(user: UserResponse, verbose = false) {
  if (verbose) return user;
  if (!isFullUser(user)) return { id: user.id };
  const base = {
    id: user.id,
    type: user.type,
    name: user.name,
    avatar_url: user.avatar_url,
  };
  if (user.type === "person") return { ...base, email: user.person.email };
  if (user.type === "bot") {
    const workspaceName =
      "workspace_name" in user.bot ? user.bot.workspace_name : undefined;
    return { ...base, workspace_name: workspaceName };
  }
  return base;
}

export function slimFileUpload(fu: FileUploadObjectResponse, verbose = false) {
  if (verbose) return fu;
  return {
    file_upload_id: fu.id,
    status: fu.status ?? null,
    ...(fu.filename ? { filename: fu.filename } : {}),
    ...(fu.content_type ? { content_type: fu.content_type } : {}),
    ...(fu.content_length !== undefined && fu.content_length !== null
      ? { content_length: fu.content_length }
      : {}),
    ...(fu.expiry_time ? { expiry_time: fu.expiry_time } : {}),
  };
}

export function slimComment(comment: CommentResponse, verbose = false) {
  if (verbose) return comment;
  if (!isFullComment(comment)) return { id: comment.id };
  return {
    id: comment.id,
    parent: comment.parent,
    discussion_id: comment.discussion_id,
    text: extractRichText(comment.rich_text),
    created_by: comment.created_by.id,
    created_time: comment.created_time,
  };
}

export function slimList<TInput, TOutput>(
  list: {
    results: TInput[];
    has_more?: boolean;
    next_cursor?: string | null;
  },
  slim: (item: TInput, verbose?: boolean) => TOutput,
  verbose = false
): { results: TOutput[]; has_more: boolean; next_cursor: string | null } {
  return {
    results: list.results.map((r) => slim(r, verbose)),
    has_more: list.has_more ?? false,
    next_cursor: list.next_cursor ?? null,
  };
}
