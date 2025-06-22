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
        view: (view) => {
            const updatePages = () => {
            const { doc, schema } = view.state;
            const tr = view.state.tr;
            let accHeight = 0;
            let pageIndex = 0;
            let pageStart: number | null = null;

            doc.descendants((node, pos) => {
                if (!node.isBlock) return;
                const dom = view.nodeDOM(pos) as HTMLElement | null;
                if (!dom) return;

                const h = dom.getBoundingClientRect().height;
                if (pageStart === null) pageStart = pos;
                if (accHeight + h > pageHeight) {
                const range = doc.resolve(pageStart).blockRange(doc.resolve(pos));
                if (range) {
                    tr.wrap(range, [
                    { type: schema.nodes.page, attrs: { class: `page page-${pageIndex}` } },
                    ]);
                }
                pageIndex += 1;
                accHeight = h;
                pageStart = pos;
                } else {
                accHeight += h;
                }
            });

            if (pageStart !== null) {
                const range = doc
                .resolve(pageStart)
                .blockRange(doc.resolve(doc.nodeSize - 2));
                if (range) {
                tr.wrap(range, [
                    { type: schema.nodes.page, attrs: { class: `page page-${pageIndex}` } },
                ]);
                }
            }
            if (tr.steps.length) view.dispatch(tr);
            };

            updatePages();
            return { update: updatePages };
        },
        }),
    ];
  },
});
