import { Pagination, paginationKey } from "tiptap-pagination-breaks";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const PaginationWithAttributes = Pagination.extend({
  name: "paginationWithAttributes",

  addProseMirrorPlugins() {
    const plugins = this.parent?.() || [];
    const pagePluginKey = paginationKey;

    plugins.push(
      new Plugin({
        key: new PluginKey("pageAttributeDecorator"),
        props: {
          decorations(state) {
            const pageState = pagePluginKey.getState(state);
            if (!pageState) return DecorationSet.empty;

            const { breakPositions } = pageState;
            const decs: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              const pageNum =
                breakPositions.filter((bp: number) => bp <= pos).length + 1;
              decs.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  "data-page": String(pageNum),
                }),
              );
            });

            return DecorationSet.create(state.doc, decs);
          },
        },
      }),
    );

    return plugins;
  },
});
