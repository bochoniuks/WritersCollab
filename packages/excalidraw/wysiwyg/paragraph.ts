import Paragraph from "@tiptap/extension-paragraph";

export const ParagraphBlock = Paragraph.extend({
  /** paragraphs participate in split/merge logic */
  splittable: true,
});