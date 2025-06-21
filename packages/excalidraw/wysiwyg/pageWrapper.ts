// packages/excalidraw/wysiwyg/pageWrapper.ts
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Extension } from "@tiptap/core";

export interface PageWrapperOptions {
  pageHeight: number;
}

export const PageWrapper = Extension.create<PageWrapperOptions>({
  name: "pageWrapper",
  addProseMirrorPlugins() {
    const { pageHeight } = this.options;
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const { doc } = state;
            const decorations: Decoration[] = [];
            let accHeight = 0;
            let pageIndex = 0;

            doc.descendants((node, pos) => {
              if (!node.isBlock) return;
              const dom = this.editor.view.nodeDOM(pos) as HTMLElement | null;
              if (!dom) return;

              const h = dom.getBoundingClientRect().height;
              if (accHeight + h > pageHeight) {
                pageIndex += 1;
                accHeight = 0;
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: `page page-${pageIndex}`,
                }),
              );
              accHeight += h;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
