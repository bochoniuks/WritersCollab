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
  splittable: false,

  addAttributes() {
    return { ...this.options.HTMLAttributes };
  },

  parseHTML() {
    return [{ tag: "div.page" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ class: "page " }, HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor.view;
        const { $from } = state.selection;

        if (
          $from.parentOffset === 0 &&
          $from.depth >= 2 &&
          $from.node(-1).type.name === "page" &&
          $from.index(-1) === 0 &&
          state.doc.resolve($from.before(-1)).nodeBefore
        ) {
          return editor
            .chain()
            .deleteSelection() // remove page boundary
            .joinBackward()    // merge paragraphs & remove last char
            .run();
        }
        return false;
      },
    };
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