import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { runPageReflow } from "./pageReflow";

export type HeightData = Map<ProseMirrorNode, number>;

export const heightTrackingPluginKey =
  new PluginKey<HeightData>("heightTracking");

const areHeightsEqual = (prev: HeightData, next: HeightData): boolean => {
    
    if (prev.size !== next.size) {
        return false;
    }
    for (const [node, height] of prev) {
        if (next.get(node) !== height) {
            return false;
        }
    }
    
    return true;
};

let preRenderPage: HTMLDivElement | null = null;

const getPreRenderPage = (
  view: EditorView,
  cfg: NonNullable<EditorView["page"]>,
) => {
  const width = cfg.width - cfg.margin.left - cfg.margin.right;
  if (!preRenderPage) {
    // const firstPage = view.dom.querySelector<HTMLDivElement>(".page");
    preRenderPage = Object.assign(document.createElement("div"), {
      className: "tiptap ProseMirror",
      id: "pre-render",
      style: `
        position:absolute;
        top:0;
        left:0;
        width:${width}px;
        margin:0;
        height:auto;
        overflow-y: hidden;
        overflow-x: hidden;
        visibility:hidden;
        pointer-events:none;
        box-sizing: border-box;
        border: 1px solid;
      `,
    });
    view.dom.parentNode?.appendChild(preRenderPage);
  } else {
    preRenderPage.style.width = `${width}px`;
  }
  return preRenderPage;
};

// const collectHeights = (
//   view: EditorView,
//   start = 0,
//   end = view.state.doc.content.size,
// ): HeightData => {
//     const heights: HeightData = new Map();
//     const visited = new Set<ProseMirrorNode>();
//     const nodes: Array<{ node: ProseMirrorNode; dom: HTMLElement }> = [];

//     const collect = (node: ProseMirrorNode, pos: number): void => {
//         if (visited.has(node)) return;
//         visited.add(node);
//         const dom = view.nodeDOM(pos) as HTMLElement | null;
//         if (dom) nodes.push({ node, dom });

//         const resolved = view.state.doc.resolve(pos);
//         if (resolved.depth > 0) {
//         collect(resolved.node(resolved.depth - 1), resolved.before(resolved.depth));
//         }
//     };

//     view.state.doc.nodesBetween(start, end, (node, pos) => {
//         if (node.isBlock) {
//             collect(node, pos);
//         }
//     });
    
    
//     for (const { node, dom } of nodes) {
//         const parent = dom.parentElement
//         console.log(parent)
//         const parentRect = parent?.getBoundingClientRect();
//         console.log("PARENT getBoundingClientRect: ",parentRect?.height,parentRect?.width)
//         console.log("PARENT scrollHeight: ",parent?.scrollHeight)
//         console.log("PARENT clientHeight: ",parent?.clientHeight)
//         console.log("PARENT scrollTop: ",parent?.scrollTop)
//         console.log(node.toJSON());
//         dom.parentElement?.offsetHeight;
//         console.log(dom);
//         const rect = dom.getBoundingClientRect();
//         // const style = window.getComputedStyle(dom);
//         // console.log(style)
//         console.log("getBoundingClientRect: ",rect.height,rect.width)
//         console.log("scrollHeight: ",dom.scrollHeight)
//         console.log("clientHeight: ",dom.clientHeight)
//         console.log("scrollTop: ",dom.scrollTop)

//         // console.log("offsetHeight: ",dom.offsetHeight,dom.offsetWidth)
//         // console.log("clientHeight: ",dom.clientHeight,dom.clientWidth)
//         // console.log("scrollHeight: ",dom.scrollHeight,dom.scrollWidth)
//         // console.log("computed: ",style.height,style.width)
//         // const lines = dom.getClientRects()
//         // console.log("Lines: ", lines.length)
//         // console.log(lines)
        
//         const height =rect.height;
//         heights.set(node, height);
//     }
//     return heights;
// };

const collectHeights = (
  view: EditorView,
  start = 0,
  end = view.state.doc.content.size,
): HeightData => {
    const cfg = view.page;
    const heights: HeightData = new Map();
    if (!cfg) return heights;

    const visited = new Set<ProseMirrorNode>();
    const nodes: Array<{ node: ProseMirrorNode; dom: HTMLElement }> = [];

    const collect = (node: ProseMirrorNode, pos: number): void => {
        if (visited.has(node)) return;
        visited.add(node);
        const dom = view.nodeDOM(pos) as HTMLElement | null;
        if (dom) nodes.push({ node, dom });
        const resolved = view.state.doc.resolve(pos);
        if (resolved.depth > 0) {
        collect(resolved.node(resolved.depth - 1), resolved.before(resolved.depth));
        }
    };
    view.state.doc.nodesBetween(start, end, (node, pos) => {
        if (node.isBlock) collect(node, pos);
    });

    const container = getPreRenderPage(view, cfg);
    if (!container) return heights;
    
    container.textContent = "";
    // console.log(container)
    for(const i in [1,2]){
        for (const { node, dom } of nodes) {
            console.log(node.type)
            if (node.type.name === "page" || node.type.name === "doc") {
                continue;
            }
            const clone = dom.cloneNode(true) as HTMLElement;
            container.appendChild(clone);
            console.log(clone)
            console.log(dom)
            const style = window.getComputedStyle(clone);
            console.log(style.fontFamily)
            console.log(style.fontSize)
            console.log(style.lineHeight)
            console.log(style.margin)
            console.log(style.padding)
            console.log(style.display)
            console.log(style.width)
            console.log(style.height)

            console.log(clone.getBoundingClientRect().width, clone.getBoundingClientRect().height)
            console.log(clone.offsetHeight,clone.offsetWidth)
            heights.set(node, clone.getBoundingClientRect().height);
        }
        console.log(container.cloneNode(true))
        // container.textContent = "";
    }
    

    return heights;
};

export const runHeightTracking = (view: EditorView) => {
  const heights = collectHeights(view);
  view.dispatch(view.state.tr.setMeta(heightTrackingPluginKey, heights));
};


export const HeightTracking = Extension.create({
  name: "heightTracking",
  addProseMirrorPlugins() {
    return [
        new Plugin<HeightData>({
            key: heightTrackingPluginKey,
            state: {
                init(): HeightData {
                    return new Map();
                },
                apply(tr, value) {
                    const meta = tr.getMeta(heightTrackingPluginKey);
                    return meta ? (meta as HeightData) : value;
                },
            },
            view(editorView: EditorView) {
                return {
                    update(view, prevState) {
                        if (prevState.doc.eq(view.state.doc)) {
                            return;
                        }
                        const prevHeights = heightTrackingPluginKey.getState(prevState) as HeightData;

                        const diffStart = view.state.doc.content.findDiffStart(prevState.doc.content);
                        if (diffStart == null) {
                            return;
                        }
                        const diffEnd =
                            view.state.doc.content.findDiffEnd(prevState.doc.content) ?? {
                            a: view.state.doc.content.size,
                            b: prevState.doc.content.size,
                        };
                        const newEnd = diffEnd.a;

                        const changedHeights = collectHeights(view, diffStart, newEnd);
                        const heights = new Map(prevHeights);
                        changedHeights.forEach((h, n) => heights.set(n, h));

                        if (!areHeightsEqual(prevHeights, heights)) {
                            view.dispatch(
                                view.state.tr.setMeta(heightTrackingPluginKey, heights),
                            );
                            runPageReflow(view);
                        }
                    },
                };
            },
            // destroy() {
            //     preRenderPage?.remove();
            //     preRenderPage = null;
            // },
        }),
    ];
  },
});
