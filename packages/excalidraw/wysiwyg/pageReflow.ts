import { Extension, Node } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, 
    type EditorState,
    type Transaction,
 } from "prosemirror-state";

import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode, ResolvedPos, Schema } from "prosemirror-model";
import { NullableGridSize } from "../types";
import { randomId } from "@excalidraw/common";

export interface PageReflowOptions {
  maxPages?: number;
}

interface SplitResult {
  first?: ProseMirrorNode;
  second?: ProseMirrorNode;
  used: number;
  didSplit: boolean;
  splitOffse?: number;
}

export const pageReflowKey = new PluginKey("pageReflow");

const splitParagraphByHeight = (
  view: EditorView,
  node: ProseMirrorNode,
  pos: number,
  remaining: number,
  schema: Schema,
) => {
    console.log("remainig: ", remaining)
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return { used: 0, didSplit: false };

    const range = document.createRange();
    console.log(dom)
    range.selectNodeContents(dom);

    // ### We need this to adap for any scaling
    const rootRect = view.dom.getBoundingClientRect();
    const rootScale = rootRect.height / view.dom.offsetHeight;
    // ###

    const rects = Array.from(range.getClientRects());

    const linesSpace = rects.map(r=>r.height).reduce((acc, current) => acc + current, 0);
    const interLinesSpace = range.getBoundingClientRect().height - linesSpace;
    const spacePerLine = interLinesSpace / rects.length;

    let used = 0, idx = 0;
    while (idx < rects.length && used + (rects[idx].height+spacePerLine)/rootScale <= remaining) {
        used += (rects[idx].height+spacePerLine)/rootScale;
        idx++;
    }
    console.log(used)
    if (used===0) return { used: 0, didSplit: false };

    
    const lastRect = rects[Math.max(0, idx - 1)];
    console.log(lastRect)
    let splitNode: ProseMirrorNode | null = null;
    let globalOffset: number | undefined = undefined;
    for (let dx = 0; dx < 5 && !globalOffset; dx++) {
        const x = lastRect.right - 1 - dx;
        const y = lastRect.top + lastRect.height / 2;
        const posInfo = view.posAtCoords({left: x, top: y});
        console.log(posInfo)
        if (!posInfo) continue;
        const $pos = view.state.doc.resolve(posInfo.pos);
        splitNode = $pos.parent;           // parent node at that position
        console.log(splitNode)
        // if(splitNode!=node) continue
        globalOffset = $pos.parentOffset;   // character offset inside the node
    }
    
    const text = node.textContent!;
    console.log(globalOffset);
    const firstText = text.slice(0, globalOffset);
    const secondText = text.slice(globalOffset);
    console.log(firstText)
    console.log(secondText)
    if (!firstText || !secondText) return { used: 0, didSplit: false };

    const totalHeight = node.attrs.renderedHeight ?? 0;
    const splitId = node.attrs.splitId ?? randomId();
    return {
        first: schema.nodes.paragraph.create({ 
            splitId,
            renderedHeight: used, 
            renderedMarginTop: node.attrs.renderedMarginTop ?? 0,
            renderedMarginBottom: 0, }, schema.text(firstText)),
        second: schema.nodes.paragraph.create({ 
            splitId,
            renderedHeight: totalHeight - used,
            renderedMarginTop: 0,
            renderedMarginBottom: node.attrs.renderedMarginBottom ?? 0, }, schema.text(secondText)),
        used,
        didSplit: true,
        splitOffset: globalOffset!
    };
}

export const PageReflow = Extension.create<PageReflowOptions>({
  name: "pageReflow",
  addOptions() {
    return { maxPages: Infinity };
  },
  addProseMirrorPlugins() {
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
            const latest = trs[trs.length - 1];
            const shouldReflow = !!latest && latest.getMeta(pageReflowKey);
            if (!shouldReflow) {
                return null;
            }

            const page = editorView?.page;
            if (!page) return null;
            const pageHeight = page.height - page.margin.top - page.margin.bottom;


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

            let anchorInfo = blocks.find(b => anchor >= b.pos && anchor < b.pos + b.node.nodeSize);
            let headInfo = blocks.find(b => head >= b.pos && head < b.pos + b.node.nodeSize);
            let anchorOff = anchorInfo ? anchor - anchorInfo.pos : anchor;
            let headOff = headInfo ? head - headInfo.pos : head;

            console.log(anchorInfo)
            console.log(headInfo)

            const pages: any[] = [];
            let accum = 0;
            let content: any[] = [];
            let currentList: ProseMirrorNode[] = [];   // <— add
            let lastListId: string | undefined;        // <— add
            let pageCount = 1;
            let prevMarginBottom = 0;

            console.log("************ STARTING NEW REFLOW **************")

            for (const { node, pos, listId } of blocks) {
                const h  = node.attrs.renderedHeight ?? 0;
                const mt = node.attrs.renderedMarginTop ?? 0;
                const mb = node.attrs.renderedMarginBottom ?? 0;
                const topGap = Math.max(prevMarginBottom, mt);
                const blockHeight = topGap + h;
                const remaining = pageHeight - accum;
                
                console.log(editorView?.nodeDOM(pos))

                console.log("DOM heights:", mt, h, mb)
                console.log(node)
                // if (listId) {  // list item
                //     lastListId = listId;  
                //     if (accum + h > pageHeight && currentList.length) {
                //         content.push(schema.nodes.bulletList.create({ listId }, currentList));
                //         pages.push(schema.nodes.page.create(null, content));
                //         if (pages.length >= maxPages) {
                //             break;
                //         }
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
                
                // const remaining = pageHeight - accum;
                // console.log(pageHeight, accum, remaining)
                console.log("prevMarginBottom: ", prevMarginBottom)
                console.log("blockHeight: ", blockHeight, "remaining: ", remaining)
                if (
                    node.type.name === "paragraph" &&
                    node.textContent &&
                    blockHeight > remaining &&
                    editorView
                ){
                    console.log("--- Paragraph --- ", h, " > ", remaining)
                    console.log(node.toJSON())

                    const split = splitParagraphByHeight(
                        editorView,
                        node,
                        pos,
                        remaining - topGap,
                        schema
                    );
                    console.log(split)
                    if (split?.didSplit && split?.splitOffset) {
                       if (anchorInfo?.node === node) {
                            if (anchorOff > split.splitOffset) {
                                anchorInfo = { node: split.second, pos: anchorInfo?.pos ?? 0 + split.splitOffset};
                                anchorOff -= split.splitOffset;
                            } else {
                                anchorInfo = { node: split.first, pos: anchorInfo?.pos ?? 0 + split.splitOffset };
                            }
                        }
                        if (headInfo?.node === node) {
                            if (headOff > split.splitOffset) {
                                headInfo = { node: split.second, pos: headInfo?.pos ?? 0 + split.splitOffset };
                                headOff -= split.splitOffset;
                            } else {
                                headInfo = { node: split.first, pos: headInfo?.pos ?? 0 + split.splitOffset };
                            }
                        }
                        content.push(split.first);
                        pages.push(schema.nodes.page.create(null, content));
                        if (pages.length >= maxPages) break;
                        pageCount += 1;
                        content = [split.second];
                        accum = h - split.used;
                        prevMarginBottom = mb;
                        continue;
                    }
                    // else {
                    //     pages.push(schema.nodes.page.create(null, content));
                    //     pageCount += 1;
                    //     content = [node];
                    //     accum = h;
                    //     continue
                    // }
                }

                if (accum + blockHeight > pageHeight && content.length) {
                    pages.push(schema.nodes.page.create(null, content));
                    if (pages.length >= maxPages) break;

                    pageCount += 1;
                    content = [node];
                    accum = blockHeight;
                } else {
                    content.push(node);
                    accum += blockHeight;
                }
                prevMarginBottom = mb;
            }

            if (pages.length < maxPages && content.length) {
                pages.push(schema.nodes.page.create(null, content));
            }
            const newDoc = schema.nodes.doc.create(null, pages);
            
            const posMap = new Map<ProseMirrorNode, number>();
            newDoc.descendants((node, pos) => {
                posMap.set(node, pos);
            });

            const resolvePos = (
            info: { node: ProseMirrorNode } | undefined,
            offset: number,
            fallback: number,
            ) => {
                const base = info ? posMap.get(info.node) : undefined;
                return base == null ? fallback : base + offset;
            };

            const anchorPos = resolvePos(anchorInfo, anchorOff, anchor);
            const headPos   = resolvePos(headInfo, headOff, head);

            if (curr.doc.eq(newDoc)) {
                return null;
            }
            const tr = curr.tr.replaceWith(0, curr.doc.content.size, newDoc.content);
            const safeAnchor = Math.min(Math.max(anchorPos, 0), tr.doc.content.size);
            const safeHead   = Math.min(Math.max(headPos,   0), tr.doc.content.size);
            tr.setSelection(TextSelection.create(tr.doc, safeAnchor, safeHead));
            // console.log(newDoc.toJSON())
            return tr;
        },
      }),
    ];
  },
});
