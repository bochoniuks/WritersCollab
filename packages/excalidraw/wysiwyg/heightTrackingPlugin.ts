import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Fragment, type Node as ProseMirrorNode } from "prosemirror-model";
import { pageReflowKey } from "./pageReflow";


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
      console.log(dom)
      console.log("pageIndex: ", pageIndex)
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
    view.dispatch(tr.setMeta(pageReflowKey, true));
  }
};

// heightTrackingPlugin.ts
const countSplitParagraphs = (doc: ProseMirrorNode, splitId: string) => {
  let count = 0;
  doc.descendants(node => {
    if (node.type.name === "paragraph" && node.attrs.splitId === splitId) {
      count++;
    }
  });
  return count;
};

const mergeSplitParagraph = (
  view: EditorView, 
  splitId: string,
  scope: "all" | "before" | "after" = "all"
) => {
  const { state } = view;
  const { anchor, head } = state.selection;
  const selectionPos = state.selection.from;

  let currentStart: number | null = null
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      if (pos < selectionPos && selectionPos < pos + node.nodeSize) {
        currentStart = pos
        return false // stop the traversal early once found
      }
    }
    return true
  })
  if (currentStart == null && scope !== 'all') {
    return null
  }

  let from: number | null = null;
  let to: number | null = null;
  const contents: any[] = [];
  let attrs: Record<string, any> | null = null;

  state.doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.attrs.splitId === splitId) {
      const isBeforeCurrent = currentStart != null && (pos + node.nodeSize) <= currentStart
      const isAfterOrCurrent = currentStart != null && pos >= currentStart

      const take =
      scope === 'all' ||
      (scope === 'before' && isBeforeCurrent) ||
      (scope === 'after' && isAfterOrCurrent)

      if (!take) return true
      
      if (from === null) {
        from = pos;
        attrs = { ...node.attrs };
        delete attrs.splitId;
        delete attrs.renderedHeight;
        delete attrs.renderedMarginTop;
        delete attrs.renderedMarginBottom;
        delete attrs.renderedPageIndex;
      }
      to = pos + node.nodeSize;
      contents.push(node.content);
    }
  });

  if (from == null || to == null || !attrs) {
    return null;
  }

  const mergedContent = contents.reduce(
    (frag, c) => frag.append(c),
    Fragment.empty
  );
  const merged = state.schema.nodes.paragraph.create(attrs, mergedContent);
  const anchorInside = anchor >= from && anchor <= to;
  const headInside = head >= from && head <= to;
  const anchorOffset = anchorInside ? anchor - from : 0;
  const headOffset = headInside ? head - from : 0;

  let tr = state.tr.replaceWith(from, to, merged);

  const newAnchor = anchorInside
    ? from + Math.min(anchorOffset, merged.nodeSize - 1)
    : tr.mapping.map(anchor, -1);
  const newHead = headInside
    ? from + Math.min(headOffset, merged.nodeSize - 1)
    : tr.mapping.map(head, -1);

  tr = tr.setSelection(TextSelection.create(tr.doc, newAnchor, newHead));
  view.dispatch(tr);
  return { from, to: from + merged.nodeSize };
};

export const HeightTracking = Extension.create({
  name: "heightTracking",
  addGlobalAttributes() {
    const blockTypes = this.extensions
      .filter(ext => {
        return (ext.type === "node" && ext.config.group == "block");
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
        view(editorView) {
          return {
            update(view, prevState) {
              if (prevState.doc.eq(view.state.doc)) return;

              const diffStart = view.state.doc.content.findDiffStart(prevState.doc.content);
              if (diffStart == null) return;
              const diff = view.state.doc.content.findDiffEnd(prevState.doc.content);
              const diffEnd = diff ? diff.a : view.state.doc.content.size;
              const from = Math.max(0, diffStart - 1);
              const to = Math.min(view.state.doc.content.size, diffEnd + 1);

              const $pos = view.state.doc.resolve(diffStart);
              const changed = $pos.parent;
              if (changed?.type.name === "paragraph" && changed.attrs.splitId) {
                const splitId = changed.attrs.splitId;
                const prevCount = countSplitParagraphs(prevState.doc, splitId);
                const currCount = countSplitParagraphs(view.state.doc, splitId);

                let merged;
                if (currCount > prevCount) {
                  merged = mergeSplitParagraph(view, splitId, "after");
                } else {
                  merged = mergeSplitParagraph(view, splitId);
                }

                if (merged) {
                  runHeightTracking(view, merged.from, merged.to);
                  return;
                }
              }

              runHeightTracking(view, from, to);
            },
          };
        },
      }),
    ];
  }
});
