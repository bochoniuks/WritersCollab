import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, 
    type EditorState,
    type Transaction,
 } from "prosemirror-state";

import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode, Schema } from "prosemirror-model";

export interface PageReflowOptions {
  maxPages?: number;
}


export const pageReflowKey = new PluginKey("pageReflow");

function markPoint(dom: HTMLElement, x: number, y: number) {
  const marker = document.createElement("div");
  marker.style.position = "fixed";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = "4px";
  marker.style.height = "4px";
  marker.style.background = "red";
  marker.style.zIndex = "999999";
  marker.style.pointerEvents = "none"; // don't block clicks
  dom.parentElement?.appendChild(marker);
}

function rectangle(dom: HTMLElement, x: number, y: number, height:number, width:number) {
  const marker = document.createElement("div");
  marker.style.position = "fixed";
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.style.background = "green";
  marker.style.zIndex = "999999";
  marker.style.pointerEvents = "none"; // don't block clicks
  dom.parentElement?.appendChild(marker);
}

const splitParagraphByHeight = (
  view: EditorView,
  node: ProseMirrorNode,
  pos: number,
  remaining: number,
  schema: Schema,
) => {
    console.log("remainig: ", remaining)
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return null;
    const range = document.createRange();
    console.log(dom)
    range.selectNodeContents(dom);

    // ### We need this to adap for any scaling
    // const rootRect = view.dom.getBoundingClientRect();
    // const rootScale = rootRect.height / view.dom.offsetHeight;
    const parent = view.dom?.closest(".scratchpad-wysiwyg#editable");
    console.log(parent)
    const style = window.getComputedStyle(parent || view.dom);
    const transform = style.transform;
    console.log(transform)
    const values = transform.match(/-?[\d.]+/g)!.map(Number);
    const [rootScale, b, c, d, e, f] = values;
    const xTranslate = e / rootScale;

    // ###

    const rects = Array.from(range.getClientRects());

    const linesSpace = rects.map(r=>r.height).reduce((acc, current) => acc + current, 0);
    const interLinesSpace = range.getBoundingClientRect().height - linesSpace;
    console.log(range.getBoundingClientRect())
    const spacePerLine = interLinesSpace / rects.length;

    console.log(rects)
    console.log("Space per line: ", spacePerLine)
    let used = 0, idx = 0;
    while (idx < rects.length && used + (rects[idx].height+spacePerLine)/rootScale <= remaining) {
        used += (rects[idx].height+spacePerLine)/rootScale;
        console.log("used: ",used)
        idx++;
    }
    
    const lastRect = rects[Math.max(0, idx - 1)];
    console.log(lastRect)
    console.log(rootScale)
    rectangle(view.dom, lastRect.x/rootScale-xTranslate, lastRect.y/rootScale, lastRect.height/rootScale, lastRect.width/rootScale);
    let caret: any = null;
    for (let dx = 0; dx < 5 && !caret; dx++) {
        // We need to use xTranslate to compensate for the 
        // translation/transformation of the editor container
        const x = (lastRect.right/rootScale) - xTranslate - 1 - dx;

        const y = lastRect.top/rootScale + lastRect.height/rootScale / 2;
        console.log("Coords:", x, y);
        console.log("Element:", document.elementFromPoint(x, y));

        markPoint(view.dom, x, y); // show marker on screen

        caret = (document as any).caretPositionFromPoint?.(x, y) ??
                    document.caretRangeFromPoint?.(x, y);
        console.log(caret)        
    }
    // console.log(caret)
    
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

    const totalHeight = node.attrs.renderedHeight ?? 0;
    return {
        first: schema.nodes.paragraph.create({ renderedHeight: used }, schema.text(firstText)),
        second: schema.nodes.paragraph.create({ renderedHeight: totalHeight - used }, schema.text(secondText)),
        used,
    };
};

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
            const shouldReflow = trs.some(tr => tr.getMeta(pageReflowKey));
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
                const h = node.attrs.renderedHeight ?? 0;
                console.log("DOM height:", h)
                console.log(node)
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
                // console.log(pageHeight, accum, remaining)
                console.log("h: ", h, "remaining: ", remaining)
                if (
                    node.type.name === "paragraph" &&
                    node.textContent &&
                    h > remaining &&
                    editorView) 
                {
                    console.log("--- Paragraph --- ", h, " > ", remaining)
                    console.log(node.toJSON())

                    const split = splitParagraphByHeight(editorView, node, pos, remaining, schema);
                    if (split) {
                        console.log(split)
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
