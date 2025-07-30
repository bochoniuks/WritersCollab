import { Node, mergeAttributes } from "@tiptap/core";

export interface PageOptions {
  HTMLAttributes: Record<string, any>;
}

export const Page = Node.create<PageOptions>({
  name: "page",
  group: "block",
  content: "block+",
  isolating: true,

  addAttributes() {
    return { ...this.options.HTMLAttributes };
  },

  parseHTML() {
    return [{ tag: "div.page" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "page " }, HTMLAttributes), 0];
  },
});
