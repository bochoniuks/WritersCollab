// packages/excalidraw/wysiwyg/pageBreak.ts
import { Mark } from "@tiptap/core";

export const PageBreak = Mark.create({
    name: "pageBreak",
    group: "inline",
    inclusive: false,

    parseHTML() {
        return [{ tag: "hr[data-page-break]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "hr",
            {
                ...HTMLAttributes,
                "data-page-break": "true",
                class: "page-break",
                style: "border:none;margin:20px 0;",
            },
        ];
    },
});
