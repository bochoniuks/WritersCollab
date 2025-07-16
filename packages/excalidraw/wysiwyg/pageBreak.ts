// packages/excalidraw/wysiwyg/pageBreak.ts
import { Mark } from "@tiptap/core";

export const PageBreak = Mark.create({
  name: "pageBreak",
  group: "page",
  inclusive: false,

  parseHTML() {
    return [{ tag: "span[data-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-page-break": "true",
        class: "page-break",
      },
      0,
    ];
  },
});
