import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { runPageReflow } from "./pageReflow";

// export type HeightData = Map<ProseMirrorNode, number>;

// export const heightTrackingPluginKey =
//   new PluginKey<HeightData>("heightTracking");

// const areHeightsEqual = (prev: HeightData, next: HeightData): boolean => {
    
//     if (prev.size !== next.size) {
//         return false;
//     }
//     for (const [node, height] of prev) {
//         if (next.get(node) !== height) {
//             return false;
//         }
//     }
    
//     return true;
// };

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

type Measured = { node: ProseMirrorNode; pos: number; height: number };

const collectHeights = (
  view: EditorView,
  start = 0,
  end = view.state.doc.content.size,
): Measured[] => {
    const measured: Measured[] = [];
    const cfg = view.page;
    // const heights: HeightData = new Map();
    // if (!cfg) return heights;

    const visited = new Set<ProseMirrorNode>();
    const nodes: Array<{ node: ProseMirrorNode; dom: HTMLElement; pos: number }> = [];

    const collect = (node: ProseMirrorNode, pos: number): void => {
        if (visited.has(node)) return;
        visited.add(node);
        const dom = view.nodeDOM(pos) as HTMLElement | null;
        if (dom) nodes.push({ node, dom, pos });
        const resolved = view.state.doc.resolve(pos);
        if (resolved.depth > 0) {
        collect(resolved.node(resolved.depth - 1), resolved.before(resolved.depth));
        }
    };
    view.state.doc.nodesBetween(start, end, (node, pos) => {
        if (node.isBlock) collect(node, pos);
    });

    // const container = getPreRenderPage(view, cfg);
    // if (!container) return heights;
    
    // container.textContent = "";

    
    for (const { node, dom, pos } of nodes) {
      measured.push({ node, pos, height: dom.getBoundingClientRect().height });
    }
    return measured;
};

export const runHeightTracking = (view: EditorView) => {
  const measured = collectHeights(view);
  let tr = view.state.tr;
  let changed = false;

  for (const { node, pos, height } of measured) {
    if (node.attrs.renderedHeight !== height) {
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        renderedHeight: height,
      });
      changed = true;
    }
  }

  if (changed) {
    view.dispatch(tr);
    runPageReflow(view);
  }
};


export const HeightTracking = Extension.create({
  name: "heightTracking",
  addGlobalAttributes() {
    return [
      {
        types: ["*"],
        attributes: {
          renderedHeight: {
            default: null,
            parseHTML: () => null,
            renderHTML: () => ({}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view(editorView) {
          return {
            update(view, prevState) {
              if (prevState.doc.eq(view.state.doc)) return;

              const diffStart = view.state.doc.content.findDiffStart(prevState.doc.content);
              if (diffStart == null) return;
              const diffEnd = view.state.doc.content.findDiffEnd(prevState.doc.content) ?? {
                a: view.state.doc.content.size,
              };

              const measured = collectHeights(view, diffStart, diffEnd.a);
              let tr = view.state.tr;
              let changed = false;

              for (const { node, pos, height } of measured) {
                if (node.attrs.renderedHeight !== height) {
                  tr = tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    renderedHeight: height,
                  });
                  changed = true;
                }
              }

              if (changed) {
                view.dispatch(tr);
                runPageReflow(view);
              }
            },
          };
        },
      }),
    ];
  }
});
