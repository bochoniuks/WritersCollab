import Paragraph from "@tiptap/extension-paragraph";
import { registerBlockStrategy } from "./blocks/registry";
import { paragraphStrategy } from "./blocks/paragraphStrategy";


registerBlockStrategy("paragraph", paragraphStrategy);


export const ParagraphBlock = Paragraph.extend({
  /** paragraphs participate in split/merge logic */
  ...Paragraph.config,
  splittable: true,
});