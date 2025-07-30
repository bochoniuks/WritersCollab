import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { HeightData, heightTrackingPluginKey } from "./heightTrackingPlugin";
import type { EditorView } from "prosemirror-view";

export interface PageReflowOptions {
  pageHeight: number;
}

export const runPageReflow = (view: EditorView) => {
  // Triggers the PageReflow plugin manually
  view.dispatch(view.state.tr.setMeta(pageReflowKey, {}));
};

export const pageReflowKey = new PluginKey("pageReflow");

export const PageReflow = Extension.create<PageReflowOptions>({
  name: "pageReflow",
  addOptions() {
    return { pageHeight: 0 };
  },
  addProseMirrorPlugins() {
    const pageHeight = this.options.pageHeight;
    return [
      new Plugin({
        key: pageReflowKey,
        appendTransaction(trs, prev, curr) {
            const shouldReflow =
                trs.some(tr => tr.docChanged) ||
                trs.some(tr => tr.getMeta(pageReflowKey));
            if (!shouldReflow) {
                return null;
            }
            const heightData =
                heightTrackingPluginKey.getState(curr) as HeightData;
            const { schema } = curr;
            const blocks: Array<{ node: any; pos: number }> = [];
            curr.doc.descendants((node, pos) => {
                if (node.type.name !== "page") {
                blocks.push({ node, pos });
                }
            });

            const pages: any[] = [];
            let accum = 0;
            let content: any[] = [];

            for (const { node } of blocks) {
                const h = heightData?.get(node) ?? 0;
                if (accum + h > pageHeight && content.length) {
                pages.push(schema.nodes.page.create(null, content));
                content = [node];
                accum = h;
                } else {
                content.push(node);
                accum += h;
                }
            }
            if (content.length) {
                pages.push(schema.nodes.page.create(null, content));
            }
            const newDoc = schema.nodes.doc.create(null, pages);
            if (curr.doc.eq(newDoc)) {
                return null;
            }
            return curr.tr.replaceWith(0, curr.doc.content.size, newDoc.content);
        },
      }),
    ];
  },
});
