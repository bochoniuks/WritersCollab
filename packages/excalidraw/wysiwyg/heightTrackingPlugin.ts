import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { runPageReflow } from "./pageReflow";


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

    for (const { node, dom, pos } of nodes) {
      console.log(dom)
      console.log(dom.getBoundingClientRect().width,dom.getBoundingClientRect().height)
      measured.push({ node, pos, height: dom.getBoundingClientRect().height });
    }
    return measured;
};

export const runHeightTracking = (view: EditorView, start = 0,
  end = view.state.doc.content.size) => {
  const measured = collectHeights(view, start, end);
  let tr = view.state.tr;
  let changed = false;

  for (const { node, pos, height } of measured) {
    if (node.attrs.renderedHeight !== height) {
      tr = tr.setNodeAttribute(pos, "renderedHeight", height);
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

              runHeightTracking(view, diffStart, diffEnd.a)
              // const measured = collectHeights(view, diffStart, diffEnd.a);
              // let tr = view.state.tr;
              // let changed = false;

              // for (const { node, pos, height } of measured) {
              //   if (node.attrs.renderedHeight !== height) {
              //     tr = tr.setNodeMarkup(pos, undefined, {
              //       ...node.attrs,
              //       renderedHeight: height,
              //     });
              //     changed = true;
              //   }
              // }

              // if (changed) {
              //   view.dispatch(tr);
              //   runPageReflow(view);
              // }
            },
          };
        },
      }),
    ];
  }
});
