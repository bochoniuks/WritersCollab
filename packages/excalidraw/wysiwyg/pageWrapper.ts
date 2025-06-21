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
                let pageStart: number | null = null;

                doc.descendants((node, pos) => {
                if (!node.isBlock) return;
                const dom = this.editor.view.nodeDOM(pos) as HTMLElement | null;
                if (!dom) return;

                const h = dom.getBoundingClientRect().height;
                if (pageStart === null) {
                    pageStart = pos;
                }
                if (accHeight + h > pageHeight) {
                    decorations.push(
                    Decoration.inline(pageStart, pos, {
                        class: `page page-${pageIndex}`,
                    }),
                    );
                    pageIndex += 1;
                    accHeight = h;
                    pageStart = pos;
                } else {
                    accHeight += h;
                }
                });

                if (pageStart !== null) {
                decorations.push(
                    Decoration.inline(pageStart, doc.nodeSize - 2, {
                    class: `page page-${pageIndex}`,
                    }),
                );
                }

                return DecorationSet.create(doc, decorations);
            },
            },
      }),
    ];
  },
});
