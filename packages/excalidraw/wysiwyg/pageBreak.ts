// packages/excalidraw/wysiwyg/pageBreak.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const PageBreak = Extension.create({
  name: "pageBreak",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pageBreak"),
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            if (!tr.docChanged) {
              return set.map(tr.mapping, tr.doc);
            }

            // Compute break positions for the updated document
            const breaks: number[] = calculateBreakOffsets(
              tr.doc,
              this.options.pageHeight,
              this.options.pageMargin,
            );
            const widgets = breaks.map(pos =>
              Decoration.widget(pos, () => {
                const hr = document.createElement("hr");
                hr.className = "page-break";
                hr.setAttribute("data-page-break", "true");
                hr.style.border = "none";
                hr.style.margin = "20px 0";
                return hr;
              }),
            );
            return DecorationSet.create(tr.doc, widgets);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
