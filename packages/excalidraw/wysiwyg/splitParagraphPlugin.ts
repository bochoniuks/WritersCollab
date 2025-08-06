import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { heightTrackingPluginKey, HeightData, runHeightTracking } from "./heightTrackingPlugin";
import { runPageReflow } from "./pageReflow";

export interface SplitParagraphOptions {
  pageHeight: number;
}

export const splitParagraphKey = new PluginKey("splitParagraph");

export const SplitParagraphPlugin = Extension.create<SplitParagraphOptions>({
  name: "splitParagraph",

  addOptions() {
    return { pageHeight: 0 };
  },

  addProseMirrorPlugins() {
    const pageHeight = this.options.pageHeight;

    return [
      new Plugin({
        key: splitParagraphKey,
        view(view: EditorView) {
          let raf: number | null = null;

          const splitOverflowing = () => {
            const heights = heightTrackingPluginKey.getState(view.state) as HeightData;
            if (!heights) return;

            let remaining = pageHeight;
            let page = 1;
            const tr = view.state.tr;
            let changed = false;

            view.state.doc.descendants((node, pos) => {
              if (node.type.name === "page") {
                remaining = pageHeight;
                page += 1;
                return true;
              }
              if (!node.isBlock || node.type.name !== "paragraph") {
                remaining -= heights.get(node) ?? 0;
                return true;
              }

              const fullHeight = heights.get(node) ?? 0;
              if (fullHeight <= remaining || !node.textContent) {
                remaining -= fullHeight;
                return false;
              }

              const dom = view.nodeDOM(pos) as HTMLElement | null;
              if (!dom) return false;

              const range = document.createRange();
              range.selectNodeContents(dom);
              const rects = Array.from(range.getClientRects());

              let used = 0;
              let idx = 0;
              while (idx < rects.length && used + rects[idx].height <= remaining) {
                used += rects[idx].height;
                idx += 1;
              }
              const lastRect = rects[Math.max(0, idx - 1)];

              let caret: any = null;
              for (let dx = 0; dx < 5 && !caret; dx++) {
                const x = lastRect.right - 1 - dx;
                const y = lastRect.top + lastRect.height / 2;
                caret =
                  document.caretPositionFromPoint?.(x, y) ??
                  document.caretRangeFromPoint?.(x, y);
              }
              if (!caret) return false;

              const offsetNode = caret.offsetNode ?? caret.startContainer;
              const offset = caret.offset ?? caret.startOffset;

              let globalIndex = 0;
              const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, null);
              let current: Node | null = walker.nextNode();
              while (current) {
                if (current === offsetNode) {
                  globalIndex += offset;
                  break;
                }
                globalIndex += (current as Text).data.length;
                current = walker.nextNode();
              }

              const text = node.textContent!;
              const firstText = text.slice(0, globalIndex);
              const secondText = text.slice(globalIndex);

              const { schema } = view.state;
              const first = schema.nodes.paragraph.create({ page }, schema.text(firstText));
              const second = schema.nodes.paragraph.create(
                { page: page + 1 },
                schema.text(secondText),
              );

              tr.replaceWith(pos, pos + node.nodeSize, [first, second]);
              changed = true;
              remaining = pageHeight - used;
              page += 1;

              return false;
            });

            if (changed) {
              view.dispatch(tr);
              runHeightTracking(view);
              runPageReflow(view);
            }
          };

          return {
            update(_, prev) {
              if (prev.doc.eq(view.state.doc)) return;
              if (raf) cancelAnimationFrame(raf);
              raf = requestAnimationFrame(splitOverflowing);
            },
          };
        },
      }),
    ];
  },
});
