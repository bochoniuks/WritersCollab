import BulletList from "@tiptap/extension-bullet-list";
import { nanoid } from "nanoid";

/**
 * Bullet list variant that carries an id so multiple fragments can be
 * recognised and merged by the page reflow logic.
 */
export const PaginatedBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listId: {
        default: () => nanoid(),
        parseHTML: el => el.getAttribute("data-list-id"),
        renderHTML: attrs => ({
          "data-list-id": attrs.listId,
        }),
      },
    };
  },
});
