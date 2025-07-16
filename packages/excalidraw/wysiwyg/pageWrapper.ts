import { Plugin, PluginKey } from "prosemirror-state";
import { Extension } from "@tiptap/core";

export interface PageWrapperOptions {
  pageHeight: number;
}

export const PageWrapper = Extension.create<PageWrapperOptions>({
  name: "pageWrapper",
  addProseMirrorPlugins() {
    const pageHeight = this.options.pageHeight;
    return [
      new Plugin({
        key: new PluginKey("pageWrapper"),
        addOptions() {
            return { pageHeight: 0 };
        },
        view: (view) => {
            let wrapping = false;

            const wrapPages = () => {
                if (wrapping) {
                return;
                }
                wrapping = true;
                const observer = (view as any).domObserver;
                observer?.stop();

                // if there are no page breaks and a page already exists, just update its size
                const hasPageBreaks = Array.from(view.dom.childNodes).some(
                  (n) => n instanceof HTMLElement && n.classList.contains("page-break"),
                );
                if (!hasPageBreaks) {
                  const existing = view.dom.querySelector<HTMLDivElement>("div.page");
                  if (existing && existing.parentNode === view.dom) {
                    wrapping = false;
                    observer?.start();
                    return;
                  }
                }


                // remove wrappers created on a previous update
                view.dom.querySelectorAll("div.page").forEach((page) => {
                while (page.firstChild) {
                    page.parentNode!.insertBefore(page.firstChild, page);
                }
                page.remove();
                });

                let currentPage: HTMLElement | null = null;
                let pageNum = 1;
                console.log("++++++++++++++++++++++++++++++++++++++++")
                Array.from(view.dom.childNodes).forEach((node) => {
                  console.log(node as HTMLElement)
                  if (node instanceof HTMLElement && node.classList.contains("page-break")) {
                      const breakNum = parseInt(node.dataset.pageNumber ?? "", 10);
                      console.log("Page Break Num: ", breakNum)
                      pageNum = (isNaN(breakNum) ? pageNum : breakNum) + 1;
                      currentPage = null;
                      return; // keep the widget but don’t wrap it
                  }

                  if (!currentPage) {
                      console.log("Page Num: ", pageNum)
                      currentPage = document.createElement("div");
                      currentPage.className = `page page-${pageNum}`;
                      currentPage.dataset.page = String(pageNum);
                      currentPage.style.minHeight = `${pageHeight}px`;
                      currentPage.style.height = `${pageHeight}px`;
                      node.parentNode!.insertBefore(currentPage, node);
                  }
                  currentPage.appendChild(node);
                });
                console.log("--------------------------------------")

                wrapping = false;
                observer?.start();
            };

            wrapPages();
            return {
                update: wrapPages,
                destroy() {
                wrapPages();
                },
            };
            },
      }),
    ];
  },
});
