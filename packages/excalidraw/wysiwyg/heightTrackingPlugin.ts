import { Extension } from "@tiptap/core";
import { Plugin  } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type Node as ProseMirrorNode } from "prosemirror-model";

import { pageReflowKey } from "./pageReflow";

import { heightTrackingInternalKey } from "./transactionFlags";

import { getBlockStrategy } from "./blocks/registry";

type Measured = {
  node: ProseMirrorNode;
  pos: number;
  height: number;
  marginTop: number;
  marginBottom: number;
  pageIndex: number; 
};

const collectHeights = (
  view: EditorView,
  start = 0,
  end = view.state.doc.content.size,
): Measured[] => {
    const measured: Measured[] = [];

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
        if (node.isBlock && node.type.name !== "page" && node.type.name !== "doc" ) {
          collect(node, pos);
        }
    });

    const rootRect = view.dom.getBoundingClientRect();
    const rootScaleY = rootRect.height / view.dom.offsetHeight;
    const pageHeight = view.page?.height
    for (const { node, dom, pos } of nodes) {
      const rect = dom.getBoundingClientRect();
      const style = getComputedStyle(dom);
      const height = rect.height / rootScaleY;
      const marginTop = parseFloat(style.marginTop) / rootScaleY;
      const marginBottom = parseFloat(style.marginBottom) / rootScaleY;
      const top = (rect.top - rootRect.top) / rootScaleY;
      const pageIndex = pageHeight ? Math.floor(top / pageHeight) : 0;
      measured.push({ node, pos, height, marginTop, marginBottom, pageIndex });
    }
    return measured;
};


export const runHeightTracking = (view: EditorView, start = 0,
  end = view.state.doc.content.size) => {
  const measured = collectHeights(view, start, end);
  let tr = view.state.tr;
  let changed = false;

  for (const { node, pos, height, marginTop, marginBottom, pageIndex } of measured) {
    if (
      node.attrs.renderedHeight !== height ||
      node.attrs.renderedMarginTop !== marginTop ||
      node.attrs.renderedMarginBottom !== marginBottom ||
      node.attrs.renderedPageIndex !== pageIndex
    ) {
      tr = tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        renderedHeight: height,
        renderedMarginTop: marginTop,
        renderedMarginBottom: marginBottom,
        renderedPageIndex: pageIndex,
      });
      changed = true;
    }
  }

  if (changed) {
    view.dispatch(
      tr
        .setMeta(pageReflowKey, true)
        .setMeta(heightTrackingInternalKey, true)
    );
  }
};



export const HeightTracking = Extension.create({
  name: "heightTracking",
  addGlobalAttributes() {
    const blockTypes = this.extensions
      .filter(ext => {
        return (ext.type === "node" && ext.config.group === "block");
      })
      .map(ext => ext.name);

    return [
      {
        // types: ["page", "paragraph", "bulletList", "listItem"],
        types: blockTypes,
        attributes: {
          renderedHeight: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
          renderedMarginTop: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
          renderedMarginBottom: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
          renderedPageIndex: {
            default: null,
            renderHTML: () => ({}),
            parseHTML: () => null,
          },
        }
        // attributes: {
        //   renderedHeight: {
        //     default: null,
        //     // renderHTML: () => ({}), // don't output a DOM attribute
        //     // parseHTML: () => null,  // ignore any DOM attribute
        //     parseHTML: element => {
        //       const v = element.getAttribute("data-rendered-height");
        //       return v ? Number(v) : null;
        //     },
        //     renderHTML: attrs =>
        //       attrs.renderedHeight == null
        //         ? {}
        //         : { "data-rendered-height": attrs.renderedHeight },
        //   }
        // },
      },
      {
      types: ["paragraph"],
      attributes: {
        splitId: {
          default: null,
          parseHTML: el => el.getAttribute("data-split-id"),
          renderHTML: attrs =>
            attrs.splitId ? { "data-split-id": attrs.splitId } : {},
        },
      },
    },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: heightTrackingInternalKey,
        state: {
          init: () => false,
          apply(tr) {
            return tr.getMeta(heightTrackingInternalKey) || false;
          },
        },
        view(editorView) {
          return {
            update(view, prevState) {
              if (
                heightTrackingInternalKey.getState(view.state) ||
                prevState.doc.eq(view.state.doc)
              ) {
                return;
              }

              const diffStart = view.state.doc.content.findDiffStart(prevState.doc.content);
              if (diffStart == null) return;
              const diff = view.state.doc.content.findDiffEnd(prevState.doc.content);
              const diffEnd = diff ? diff.a : view.state.doc.content.size;
              const from = Math.max(0, diffStart - 1);
              const to = Math.min(view.state.doc.content.size, diffEnd + 1);

              const action = decideSplitAction(prevState, view.state);
              console.log(action)
              if (action.type !== ActionType.DO_NOTHING) {
                applySplitAction(view, action);
              }

              runHeightTracking(view, from, to);
            },
          };
        },
      }),
    ];
  }
});
