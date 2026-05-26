type Any = Record<string, unknown>;

function extractRichText(rich: unknown): string {
  if (!Array.isArray(rich)) return "";
  return rich
    .map((r) => {
      if (typeof r !== "object" || r === null) return "";
      const obj = r as Any;
      if (typeof obj.plain_text === "string") return obj.plain_text;
      const text = obj.text as Any | undefined;
      if (text && typeof text.content === "string") return text.content;
      return "";
    })
    .join("");
}

function extractTitle(properties: unknown): string | undefined {
  if (typeof properties !== "object" || properties === null) return undefined;
  for (const value of Object.values(properties as Any)) {
    if (typeof value !== "object" || value === null) continue;
    const prop = value as Any;
    if (prop.type === "title" && Array.isArray(prop.title)) {
      return extractRichText(prop.title);
    }
  }
  return undefined;
}

export function slimPage(page: unknown, verbose = false): unknown {
  if (verbose) return page;
  if (typeof page !== "object" || page === null) return page;
  const p = page as Any;
  return {
    id: p.id,
    url: p.url,
    title: extractTitle(p.properties),
    parent: p.parent,
    archived: (p.archived as boolean | undefined) ?? (p.in_trash as boolean | undefined) ?? false,
    in_trash: (p.in_trash as boolean | undefined) ?? (p.archived as boolean | undefined) ?? false,
    icon: typeof p.icon === "object" && p.icon !== null ? (p.icon as Any).type : null,
    created_time: p.created_time,
    last_edited_time: p.last_edited_time,
  };
}

export function slimBlock(block: unknown, verbose = false): unknown {
  if (verbose) return block;
  if (typeof block !== "object" || block === null) return block;
  const b = block as Any;
  const type = typeof b.type === "string" ? b.type : "";
  const inner = type ? (b[type] as Any | undefined) : undefined;
  let text: string | undefined;
  if (inner && Array.isArray(inner.rich_text)) text = extractRichText(inner.rich_text);
  return {
    id: b.id,
    type,
    text,
    has_children: b.has_children,
    archived: (b.archived as boolean | undefined) ?? (b.in_trash as boolean | undefined) ?? false,
    in_trash: (b.in_trash as boolean | undefined) ?? (b.archived as boolean | undefined) ?? false,
    ...(type === "to_do" && inner && typeof inner.checked === "boolean"
      ? { checked: inner.checked }
      : {}),
    ...(type === "code" && inner && typeof inner.language === "string"
      ? { language: inner.language }
      : {}),
    ...(type === "image" && inner
      ? { image: (inner.external as Any | undefined)?.url ?? (inner.file as Any | undefined)?.url }
      : {}),
  };
}

export function slimDatabase(db: unknown, verbose = false): unknown {
  if (verbose) return db;
  if (typeof db !== "object" || db === null) return db;
  const d = db as Any;
  const props = d.properties as Any | undefined;
  return {
    id: d.id,
    url: d.url,
    title: Array.isArray(d.title) ? extractRichText(d.title) : undefined,
    description: Array.isArray(d.description) ? extractRichText(d.description) : undefined,
    parent: d.parent,
    archived: (d.archived as boolean | undefined) ?? (d.in_trash as boolean | undefined) ?? false,
    in_trash: (d.in_trash as boolean | undefined) ?? (d.archived as boolean | undefined) ?? false,
    is_inline: d.is_inline,
    properties: props
      ? Object.fromEntries(
          Object.entries(props).map(([k, v]) => {
            const pv = v as Any;
            return [k, { type: pv.type, name: pv.name }];
          })
        )
      : {},
    created_time: d.created_time,
    last_edited_time: d.last_edited_time,
  };
}

export function slimUser(user: unknown, verbose = false): unknown {
  if (verbose) return user;
  if (typeof user !== "object" || user === null) return user;
  const u = user as Any;
  return {
    id: u.id,
    type: u.type,
    name: u.name,
    avatar_url: u.avatar_url,
    ...(u.type === "person" && typeof u.person === "object" && u.person !== null
      ? { email: (u.person as Any).email }
      : {}),
    ...(u.type === "bot" && typeof u.bot === "object" && u.bot !== null
      ? { workspace_name: (u.bot as Any).workspace_name }
      : {}),
  };
}

export function slimComment(comment: unknown, verbose = false): unknown {
  if (verbose) return comment;
  if (typeof comment !== "object" || comment === null) return comment;
  const c = comment as Any;
  return {
    id: c.id,
    parent: c.parent,
    discussion_id: c.discussion_id,
    text: Array.isArray(c.rich_text) ? extractRichText(c.rich_text) : "",
    created_by: typeof c.created_by === "object" && c.created_by !== null
      ? (c.created_by as Any).id
      : undefined,
    created_time: c.created_time,
  };
}

export function slimList<T>(
  list: { results: unknown[]; has_more?: boolean; next_cursor?: string | null },
  slim: (item: unknown, verbose?: boolean) => T,
  verbose = false
): { results: T[]; has_more: boolean; next_cursor: string | null } {
  return {
    results: list.results.map((r) => slim(r, verbose)),
    has_more: list.has_more ?? false,
    next_cursor: list.next_cursor ?? null,
  };
}
