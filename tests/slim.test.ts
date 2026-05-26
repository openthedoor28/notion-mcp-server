import { describe, it, expect } from "vitest";
import {
  slimPage,
  slimBlock,
  slimDatabase,
  slimUser,
  slimComment,
  slimList,
} from "../src/utils/slim.js";

// Tests use minimal stub objects that only include the fields the slim
// helpers read. Casting through unknown lets the fixtures stay focused.
const fx = <T>(value: unknown): T => value as T;

describe("slimPage", () => {
  it("extracts id, url, parent, archived, icon type, and title from properties", () => {
    const page = fx<Parameters<typeof slimPage>[0]>({
      object: "page",
      id: "p1",
      url: "https://notion.so/p1",
      parent: { type: "page_id", page_id: "parent" },
      archived: false,
      in_trash: false,
      icon: { type: "emoji", emoji: "📦" },
      created_time: "t1",
      last_edited_time: "t2",
      properties: {
        Name: {
          type: "title",
          title: [{ plain_text: "Hello world" }],
        },
        Status: { type: "select", select: { name: "Open" } },
      },
    });
    expect(slimPage(page)).toEqual({
      id: "p1",
      url: "https://notion.so/p1",
      title: "Hello world",
      parent: { type: "page_id", page_id: "parent" },
      archived: false,
      in_trash: false,
      icon: "emoji",
      created_time: "t1",
      last_edited_time: "t2",
    });
  });

  it("returns raw input when verbose is true", () => {
    const page = fx<Parameters<typeof slimPage>[0]>({ object: "page", id: "p1", random: "stuff" });
    expect(slimPage(page, true)).toBe(page);
  });
});

describe("slimBlock", () => {
  it("extracts text from rich_text and includes type-specific fields", () => {
    const todo = fx<Parameters<typeof slimBlock>[0]>({
      object: "block",
      id: "b1",
      type: "to_do",
      has_children: false,
      to_do: {
        rich_text: [{ plain_text: "buy milk" }],
        checked: true,
      },
    });
    expect(slimBlock(todo)).toMatchObject({
      id: "b1",
      type: "to_do",
      text: "buy milk",
      checked: true,
    });
  });

  it("surfaces code language and image url", () => {
    const code = fx<Parameters<typeof slimBlock>[0]>({
      object: "block",
      id: "c1",
      type: "code",
      code: { rich_text: [{ plain_text: "x=1" }], language: "python" },
    });
    expect(slimBlock(code)).toMatchObject({ type: "code", language: "python", text: "x=1" });

    const image = fx<Parameters<typeof slimBlock>[0]>({
      object: "block",
      id: "i1",
      type: "image",
      image: { type: "external", external: { url: "https://e.com/x.png" } },
    });
    expect(slimBlock(image)).toMatchObject({ type: "image", image: "https://e.com/x.png" });
  });
});

describe("slimDatabase", () => {
  it("extracts title and surfaces data_sources, is_locked, in_trash", () => {
    const db = fx<Parameters<typeof slimDatabase>[0]>({
      object: "database",
      id: "d1",
      url: "u",
      title: [{ plain_text: "Tasks" }],
      description: [],
      parent: { type: "page_id" },
      in_trash: false,
      is_inline: false,
      is_locked: true,
      data_sources: [
        { id: "ds-1", name: "Source A" },
        { id: "ds-2", name: "Source B" },
      ],
      icon: { type: "emoji", emoji: "📋" },
      created_time: "t1",
      last_edited_time: "t2",
    });
    expect(slimDatabase(db)).toMatchObject({
      id: "d1",
      url: "u",
      title: "Tasks",
      is_locked: true,
      in_trash: false,
      data_sources: [
        { id: "ds-1", name: "Source A" },
        { id: "ds-2", name: "Source B" },
      ],
      icon: "emoji",
    });
  });
});

describe("slimUser", () => {
  it("includes person.email for person users", () => {
    const u = fx<Parameters<typeof slimUser>[0]>({
      id: "u1",
      type: "person",
      name: "Yara",
      person: { email: "y@e.com" },
    });
    expect(slimUser(u)).toMatchObject({ id: "u1", type: "person", email: "y@e.com" });
  });

  it("includes bot.workspace_name for bot users", () => {
    const u = fx<Parameters<typeof slimUser>[0]>({
      id: "b1",
      type: "bot",
      name: "Bot",
      bot: { workspace_name: "My WS" },
    });
    expect(slimUser(u)).toMatchObject({ id: "b1", type: "bot", workspace_name: "My WS" });
  });
});

describe("slimComment", () => {
  it("collapses rich_text to plain text", () => {
    const c = fx<Parameters<typeof slimComment>[0]>({
      id: "c1",
      parent: { type: "page_id", page_id: "p1" },
      discussion_id: "d1",
      rich_text: [{ plain_text: "hi" }, { plain_text: " there" }],
      created_by: { id: "u1" },
      created_time: "t",
    });
    expect(slimComment(c)).toMatchObject({ text: "hi there", created_by: "u1" });
  });
});

describe("slimList", () => {
  it("maps results and normalizes pagination fields", () => {
    const out = slimList(
      {
        results: [fx<Parameters<typeof slimPage>[0]>({ object: "page", id: "p1", properties: {} })],
        has_more: true,
        next_cursor: "n",
      },
      slimPage
    );
    expect(out.has_more).toBe(true);
    expect(out.next_cursor).toBe("n");
    expect(out.results).toHaveLength(1);
  });

  it("defaults missing pagination fields", () => {
    const out = slimList<Parameters<typeof slimPage>[0], ReturnType<typeof slimPage>>(
      { results: [] },
      slimPage
    );
    expect(out.has_more).toBe(false);
    expect(out.next_cursor).toBe(null);
  });
});
