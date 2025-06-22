import { Plugin, PluginKey } from "prosemirror-state";
import { Extension } from "@tiptap/core";

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
            // remove wrappers created on a previous update
            view.dom.querySelectorAll("div.page").forEach((page) => {
              while (page.firstChild) {
                page.parentNode!.insertBefore(page.firstChild, page);
              }
              page.remove();
            });

            let currentPage: HTMLElement | null = null;
            let pageNum = 1;

            Array.from(view.dom.childNodes).forEach((node) => {
              if (node instanceof HTMLElement && node.classList.contains("page-break")) {
                // page-break marks the start of a new page
                pageNum = parseInt(node.dataset.pageNumber ?? `${pageNum + 1}`);
                currentPage = null;
                return; // keep the widget but don’t wrap it
              }

              if (!currentPage) {
                currentPage = document.createElement("div");
                currentPage.className = `page page-${pageNum}`;
                currentPage.dataset.page = String(pageNum);
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
