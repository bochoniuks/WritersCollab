import { Extension } from "@tiptap/core";
import { Plugin, PluginKey  } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { type Node as ProseMirrorNode } from "prosemirror-model";
import {
  decideSplitAction,
  ActionType,
  type Action,
} from "./paragraphControl";
import { randomId } from "@excalidraw/common";
import { pageReflowKey } from "./pageReflow";

import { heightTrackingInternalKey } from "./transactionFlags";

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

const applySplitAction = (view: EditorView, action: Action) => {
  const { state } = view;
  let tr = state.tr;

  switch (action.type) {
    case ActionType.KEEP_START_SPLIT_ID: {
        console.log("KEEP_START_SPLIT_ID")
      // TODO: This case should include the splitId in the start node 
      // and remove the splitId in the end node.
        const { splitId } = action;
        const $from = state.selection.$from;
        const startPos = $from.before();

        // include splitId in the start node
        tr = tr.setNodeMarkup(startPos, undefined, {
          ...$from.parent.attrs,
          splitId,
        });

        // remove splitId from the end node
        let endPos = startPos + $from.parent.nodeSize;
        let end = state.doc.nodeAt(endPos);
        if (end?.type.name === "page") {
          endPos += 1;                     // move to first child of the page
          end = state.doc.nodeAt(endPos);
        }
        if (end?.type.name === "paragraph") {
          const attrs = { ...end.attrs };
          delete attrs.splitId;
          tr = tr.setNodeMarkup(endPos, undefined, attrs);
        }

        view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
        break;
    }
    case ActionType.KEEP_END_SPLIT_ID: {
      console.log("KEEP_END_SPLIT_ID")
      // TODO: This case should include the splitId in the end node and 
      // remove the splitId in the start node.
      const { splitId } = action;
      const $from = state.selection.$from;
      const endPos = $from.before();                       // start of new paragraph

      // ensure the new (end) paragraph keeps the splitId
      tr = tr.setNodeMarkup(endPos, undefined, {
        ...$from.parent.attrs,
        splitId,
      });

      // remove the splitId from the paragraph before the split
      const $prev = state.doc.resolve(endPos);
      const prevNode = $prev.nodeBefore;
      if (prevNode && prevNode.type.name === "paragraph") {
        const startPos = endPos - prevNode.nodeSize;
        const attrs = { ...prevNode.attrs };
        delete attrs.splitId;
        tr = tr.setNodeMarkup(startPos, undefined, attrs);
      }

      view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
      break;
    }
    case ActionType.BREAK_SPLIT_ID: {
      console.log("BREAK_SPLIT_ID")
      // TODO: This case should include the splitId in the start node and 
      // define a new one that will be replaces for every paragraph after 
      // the start node that use the start node splitId
      const { splitId } = action;
      const $from = state.selection.$from;
      const startPos = $from.before();
      const newId = randomId();

      // keep original splitId in the start node
      tr = tr.setNodeMarkup(startPos, undefined, {
        ...$from.parent.attrs,
        splitId,
      });

      // assign new splitId to all subsequent contiguous paragraphs sharing the old one
      let pos = startPos + $from.parent.nodeSize;
      let node = state.doc.nodeAt(pos);
      while (node && node.type.name === "paragraph" && node.attrs.splitId === splitId) {
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, splitId: newId });
        pos += node.nodeSize;
        node = state.doc.nodeAt(pos);
      }

      view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
      break;
    }
    case ActionType.REPLACE_SPLIT_ID: {
      console.log("REPLACE_SPLIT_ID")
      const { keepSplitId, replaceSplitId } = action;
      state.doc.descendants((node, pos) => {
        if (node.type.name === "paragraph" && node.attrs.splitId === replaceSplitId) {
          tr = tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            splitId: keepSplitId,
          });
        }
      });
      view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
      break;
    }
    case ActionType.MERGE_NODES_END:
      console.log("MERGE_NODES_END")
      // TODO: This case should use the splitId from the end node for the 
      // new node and replace all the nodes with splitId from start node 
      // for the splitId from end Node.
      const { endSplitId, startSplitId } = action;
      const $from = state.selection.$from;
      const startPos = $from.before();

      // resulting node adopts the end node's splitId
      tr = tr.setNodeMarkup(startPos, undefined, {
        ...$from.parent.attrs,
        splitId: endSplitId,
      });

      // replace any remaining nodes that used the start splitId
      if (startSplitId) {
        state.doc.descendants((node, pos) => {
          if (node.type.name === "paragraph" && node.attrs.splitId === startSplitId) {
            tr = tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              splitId: endSplitId,
            });
          }
        });
      }

      view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
      break;
    case ActionType.PARAGRAPH_BREAK:
    case ActionType.DO_NOTHING:
    default:
      // handled elsewhere or no structural changes
      break;
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
