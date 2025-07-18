import { Extension, CommandProps } from '@tiptap/core';
import {
  Plugin,
  PluginKey,
  EditorState,
  Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node } from 'prosemirror-model';
import { findBreakOffsetForHeight } from '@excalidraw/element/parseTiptapDoc';
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '@excalidraw/common';

export interface PaginationOptions {
  pageHeight: number;
  pageWidth: number;
  pageMargin: number;
  label?: string;
  showPageNumber?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagination: {
      setPaginationOptions: (options: Partial<PaginationOptions>) => ReturnType;
    };
  }
}

export const Pagination = Extension.create<PaginationOptions>({
    name: 'pagination',
    addOptions() {
        return {
            pageHeight: 1056,
            pageWidth: 816,
            pageMargin: 96,
            label: 'Page',
            showPageNumber: true,
        };
    },
    addCommands() {
        return {
            setPaginationOptions: (options: Partial<PaginationOptions>) =>
                ({ tr, dispatch }: CommandProps) => {
                    if (dispatch) {
                    tr.setMeta('paginationOptions', options);
                    }
                    return true;
                },
        };
    },
    onUpdate() {
        // Apply the page width and margin to the editor's container
        const editorContainer = this.editor.view.dom.closest('.ProseMirror') as HTMLElement;
        if (editorContainer) {
            const htmlElement = editorContainer; // Cast to HTMLElement
            htmlElement.style.width = `${this.options.pageWidth}px`;
            htmlElement.style.margin = `${this.options.pageMargin}px auto`;
        }
    },
    addProseMirrorPlugins() {
        const pluginKey = new PluginKey('pagination');
        return [
            new Plugin<PaginationOptions>({
                key: pluginKey,
                state: {
                    init: () => ({ ...this.options }),
                    apply: (tr: Transaction, value: PaginationOptions) => {
                        const newOptions = tr.getMeta('paginationOptions');
                        return newOptions ? { ...value, ...newOptions } : value;
                    },
                },
                props: {
                    decorations: (state) => {
                        const { doc } = state;
                        const decorations: Decoration[] = [];
                        let currentPageHeight = 0;
                        let pageNumber = 1;
                        const options = pluginKey.getState(state) as PaginationOptions;
                        const { pageHeight, pageMargin, pageWidth, showPageNumber, label } = options;
                        const effectivePageHeight = pageHeight - 2 * pageMargin;
                        // const createPageBreak = (pos: number) =>
                        //     Decoration.widget(pos, () => {
                        //         const pageBreak = document.createElement('div');
                        //         pageBreak.className = 'page-break';
                        //         pageBreak.style.cssText = `
                        //             height: 20px;
                        //             width: 100%;
                        //             border-top: 1px dashed #ccc;
                        //             margin: 10px 0;
                        //             position: relative;
                        //             `;
                        //         pageBreak.setAttribute('data-page-number', String(pageNumber));
                        //         if (showPageNumber) {
                        //             const pageIndicator = document.createElement('span');
                        //             pageIndicator.className = 'page-number';
                        //             pageIndicator.textContent = `${label || 'Page'} ${pageNumber}`;
                        //             pageIndicator.style.cssText = `
                        //                 position: absolute;
                        //                 right: 0;
                        //                 top: -10px;
                        //                 font-size: 12px;
                        //                 color: #666;
                        //                 background: white;
                        //                 padding: 0 4px;
                        //             `;
                        //             pageBreak.appendChild(pageIndicator);
                        //         }
                        //         console.log("Assigned Page Break: ", pageNumber)
                        //         pageNumber++;
                        //         return pageBreak;
                        //     });

                        const breakPositions: number[] = [];
                        let pos = 0;
                        let remainingDoc = doc.toJSON();

                        while (true) {
                        const breakOffset = findBreakOffsetForHeight(
                            remainingDoc,
                            pageWidth - 2 * pageMargin,
                            effectivePageHeight,
                            { fontFamily: DEFAULT_FONT_FAMILY, fontSize: DEFAULT_FONT_SIZE }
                        );
                        if (breakOffset <= 0) {
                            break;
                        }
                        pos += breakOffset;
                        breakPositions.push(pos);
                        remainingDoc = doc.cut(pos).toJSON();
                        }

                        for (const p of breakPositions) {
                        decorations.push(
                            Decoration.widget(p, () => {
                            const pageBreak = document.createElement("hr");
                            pageBreak.className = "page-break";
                            pageBreak.setAttribute("data-page-break", "true");
                            pageBreak.style.border = "none";
                            pageBreak.style.margin = "20px 0";
                            pageNumber++;
                            return pageBreak;
                            })
                        );
                        }
                        return DecorationSet.create(doc, decorations);
                    },
                },
            }),
        ];
    },
    addGlobalAttributes() {
        return [
            {
                types: ['textStyle'],
                attributes: {
                    class: {
                        default: null,
                        parseHTML: (element) => element.getAttribute('class'),
                        renderHTML: (attributes) => attributes.class ? { class: attributes.class } : {},
                    },
                },
            },
        ];
    },
});
function calculateListItemHeight(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return (element.offsetHeight + marginTop + marginBottom + paddingTop + paddingBottom);
}
