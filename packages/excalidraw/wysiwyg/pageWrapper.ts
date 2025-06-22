import { Plugin, PluginKey } from "prosemirror-state";
import { Extension } from "@tiptap/core";
import { paginationKey } from "tiptap-pagination-breaks";

export interface PageWrapperOptions {
  pageHeight: number;
}

export const PageWrapper = Extension.create<PageWrapperOptions>({
  name: "pageWrapper",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pageWrapper"),
        view: (view) => {
          const wrapPages = () => {
            const pageState = paginationKey.getState(view.state);
            if (!pageState) return;

            // remove previously created wrappers
            view.dom.querySelectorAll("div.page").forEach((page) => {
              while (page.firstChild) {
                page.parentNode!.insertBefore(page.firstChild, page);
              }
              page.remove();
            });

            // group nodes by data-page attribute
            let currentPage: HTMLElement | null = null;
            Array.from(view.dom.childNodes).forEach((node) => {
              if (!(node instanceof HTMLElement)) return;
              const pageNum = node.dataset.page;
              if (!pageNum) return;

              if (!currentPage || currentPage.dataset.page !== pageNum) {
                currentPage = document.createElement("div");
                currentPage.className = `page page-${pageNum}`;
                currentPage.dataset.page = pageNum;
                node.parentNode!.insertBefore(currentPage, node);
              }
              currentPage.appendChild(node);
            });
          };

          wrapPages();
          return { update: wrapPages };
        },
      }),
    ];
  },
});
