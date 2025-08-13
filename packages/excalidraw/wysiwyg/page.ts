import { Node, mergeAttributes, Extension } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin } from "@tiptap/pm/state";

export interface PageOptions {
  HTMLAttributes: Record<string, any>;
}

export const Page = Node.create<PageOptions>({
  name: "page",
  group: "block",
  content: "block+",
  isolating: false,

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


export const pageConfigPlugin = (
  cfg: NonNullable<EditorView["page"]>,
) =>
  Extension.create({
    name: "pageConfig",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          view(view) {
            view.page = cfg;
            return {
              destroy() {
                delete view.page;
              },
            };
          },
        }),
      ];
    },
  });