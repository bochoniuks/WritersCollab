import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, 
    type EditorState,
    type Transaction,
 } from "prosemirror-state";
import { HeightData, heightTrackingPluginKey } from "./heightTrackingPlugin";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";

export interface PageReflowOptions {
  pageHeight: number;
  maxPages?: number;
}

export const runPageReflow = (view: EditorView) => {
  // Triggers the PageReflow plugin manually
  view.dispatch(view.state.tr.setMeta(pageReflowKey, {}));
};

export const pageReflowKey = new PluginKey("pageReflow");

const splitParagraphByHeight = (
  view: EditorView,
  node: ProseMirrorNode,
  pos: number,
  remaining: number,
  schema: Schema,
) => {
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return null;
    const range = document.createRange();
    range.selectNodeContents(dom);
    const rects = Array.from(range.getClientRects());
    let used = 0, idx = 0;
    while (idx < rects.length && used + rects[idx].height <= remaining) {
        used += rects[idx].height;
        idx++;
    }
    const lastRect = rects[Math.max(0, idx - 1)];
    let caret: any = null;
    for (let dx = 0; dx < 5 && !caret; dx++) {
        const x = lastRect.right - 1 - dx;
        const y = lastRect.top + lastRect.height / 2;
        caret = (document as any).caretPositionFromPoint?.(x, y) ??
                    document.caretRangeFromPoint?.(x, y);
    }
    if (!caret) return null;
    const offsetNode = caret.offsetNode ?? caret.startContainer;
    const offset = caret.offset ?? caret.startOffset;
    let globalIndex = 0;
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, null);
    for (let cur = walker.nextNode(); cur; cur = walker.nextNode()) {
        if (cur === offsetNode) { globalIndex += offset; break; }
        globalIndex += (cur as Text).data.length;
    }
    const text = node.textContent!;
    const firstText = text.slice(0, globalIndex);
    const secondText = text.slice(globalIndex);
    if (!firstText || !secondText) return null;
    return {
        first: schema.nodes.paragraph.create(null, schema.text(firstText)),
        second: schema.nodes.paragraph.create(null, schema.text(secondText)),
        used,
    };
};

export const PageReflow = Extension.create<PageReflowOptions>({
  name: "pageReflow",
  addOptions() {
    return { pageHeight: 0, maxPages: Infinity };
  },
  addProseMirrorPlugins() {
    const pageHeight = this.options.pageHeight;
    const maxPages = this.options.maxPages ?? Infinity;
    let editorView: EditorView | null = null;
    return [
      new Plugin({
        key: pageReflowKey,
        view(view) {
            editorView = view;
            return { destroy() { editorView = null; } };
        },
        appendTransaction(trs: readonly Transaction[],
                            prev: EditorState ,
                            curr: EditorState,) {
            const shouldReflow = trs.some(tr => tr.getMeta(pageReflowKey));
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
            for (const { node, pos, listId } of blocks) {
                const h = heightData?.get(node) ?? 0;

                if (listId) {  // list item
                    lastListId = listId;  
                    if (accum + h > pageHeight && currentList.length) {
                        content.push(schema.nodes.bulletList.create({ listId }, currentList));
                        pages.push(schema.nodes.page.create(null, content));
                        if (pages.length >= maxPages) {
                            break;
                        }
                        content = [];
                        currentList = [];
                        accum = 0;
                    }
                    currentList.push(node);
                    accum += h;
                    continue;
                }

                if (currentList.length) {
                    content.push(schema.nodes.bulletList.create({ listId: lastListId }, currentList));
                    currentList = [];
                }
                
                const remaining = pageHeight - accum;
                if (
                    node.type.name === "paragraph" &&
                    node.textContent &&
                    h > remaining &&
                    editorView) 
                {
                    const split = splitParagraphByHeight(editorView, node, pos, remaining, schema);
                    if (split) {
                        content.push(split.first);
                        pages.push(schema.nodes.page.create(null, content));
                        if (pages.length >= maxPages) break;
                        pageCount += 1;
                        content = [split.second];
                        accum = h - split.used;
                        continue;
                    }
                }

                if (accum + h > pageHeight && content.length) {
                    pages.push(schema.nodes.page.create(null, content));
                    if (pages.length >= maxPages) {
                        break;
                    }
                    pageCount += 1;
                    content = [node];
                    accum = h;
                } else {
                    content.push(node);
                    accum += h;
                }
            }

            if (pages.length < maxPages && content.length) {
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
