// packages/excalidraw/wysiwyg/pageNode.ts
import { Node, mergeAttributes } from "@tiptap/core";

export const PageNode = Node.create({
  name: "page",
  group: "block",
  content: "block*",
  parseHTML() {
    return [{ tag: "div.page" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "page" }, HTMLAttributes), 0];
  },
});
