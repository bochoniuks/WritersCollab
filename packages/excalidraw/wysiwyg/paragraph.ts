import Paragraph from "@tiptap/extension-paragraph";

export const ParagraphBlock = Paragraph.extend({
  /** paragraphs participate in split/merge logic */
  ...Paragraph.config,
  splittable: true,
});