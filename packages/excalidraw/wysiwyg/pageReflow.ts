import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { HeightData, heightTrackingPluginKey } from "./heightTrackingPlugin";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";

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
            const blocks: Array<{ node: any; pos: number; listId?: string }> = [];

            const { anchor, head } = curr.selection;
            

            curr.doc.descendants((node, pos) => {
                if (pos === 0 || node.type.name === "page") {
                    return true;                      // skip doc and page nodes but traverse inside them
                }
                if (node.type.name === "bulletList") {
                    const id = node.attrs.listId;
                    node.forEach((li, offset) => {
                        blocks.push({ node: li, pos: pos + offset + 1, listId: id });
                    });
                    return false;                   // prevent pushing the list node itself
                }
                if (node.isBlock) {                   // collect only block-level content
                    blocks.push({ node, pos });
                    return false;                     // no need to visit inline children
                }
            });

            const anchorInfo = blocks.find(b => anchor >= b.pos && anchor < b.pos + b.node.nodeSize);
            const headInfo = blocks.find(b => head >= b.pos && head < b.pos + b.node.nodeSize);
            const anchorOff = anchorInfo ? anchor - anchorInfo.pos : anchor;
            const headOff = headInfo ? head - headInfo.pos : head;

            const pages: any[] = [];
            let accum = 0;
            let content: any[] = [];
            let currentList: ProseMirrorNode[] = [];   // <— add
            let lastListId: string | undefined;        // <— add
            let pageCount = 1;
            for (const { node, listId } of blocks) {
                const h = heightData?.get(node) ?? 0;
                console.log(node)

                // if (listId) {  // list item
                //     lastListId = listId;  
                //     if (accum + h > pageHeight && currentList.length) {
                //         content.push(schema.nodes.bulletList.create({ listId }, currentList));
                //         pages.push(schema.nodes.page.create(null, content));
                //         console.log("Page: ", accum)
                //         content = [];
                //         currentList = [];
                //         accum = 0;
                //     }
                //     currentList.push(node);
                //     accum += h;
                //     continue;
                // }

                // if (currentList.length) {
                //     content.push(schema.nodes.bulletList.create({ listId: lastListId }, currentList));
                //     currentList = [];
                // }

                if (accum + h > pageHeight && content.length) {
                    console.log("accum: ",accum, "pageHeight: ",pageHeight)
                    pages.push(schema.nodes.page.create(null, content));
                    console.log("Page Closed: ", pageCount, " - ", accum)
                    pageCount += 1;
                    content = [node];
                    accum = h;
                } else {
                    content.push(node);
                    accum += h;
                    console.log("Page: ", pageCount, " - ", accum, " - [",h,"]")
                }
            }

            if (content.length) {
                pages.push(schema.nodes.page.create(null, content));
            }
            const newDoc = schema.nodes.doc.create(null, pages);
            
            const posMap = new Map<ProseMirrorNode, number>();
                newDoc.descendants((node, pos) => {
                posMap.set(node, pos);
            });
            const anchorPos = anchorInfo ? posMap.get(anchorInfo.node)! + anchorOff : anchor;
            const headPos = headInfo ? posMap.get(headInfo.node)! + headOff : head;

            if (curr.doc.eq(newDoc)) {
                return null;
            }
            const tr = curr.tr.replaceWith(0, curr.doc.content.size, newDoc.content);
            tr.setSelection(TextSelection.create(tr.doc, anchorPos, headPos));
            return tr;
        },
      }),
    ];
  },
});
