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
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_SCRATCHPAD_PAGE_MARGIN, SCRATCHPAD_PAGE_GAP } from '@excalidraw/common';

export interface PaginationOptions {
  pageHeight: number;
  pageWidth: number;
  pageMargin: { top: number; right: number; bottom: number; left: number };
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
            pageMargin: { ...DEFAULT_SCRATCHPAD_PAGE_MARGIN },
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
            htmlElement.style.marginTop = `${this.options.pageMargin.top}px`;
            htmlElement.style.marginBottom = `${this.options.pageMargin.bottom}px`;
            htmlElement.style.marginLeft = `${this.options.pageMargin.left}px`;
            htmlElement.style.marginRight = `${this.options.pageMargin.right}px`;
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
                        const effectivePageHeight = pageHeight - (pageMargin.left + pageMargin.right);
                        
                        const breakPositions: number[] = [];
                        let pos = 0;
                        // console.log(doc)
                        let remainingDoc = doc.toJSON();
                        // console.log(remainingDoc)

                        while (true) {
                            const breakOffset = findBreakOffsetForHeight(
                                remainingDoc,
                                pageWidth - (pageMargin.left + pageMargin.right),
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
                            pageBreak.style.height = `${SCRATCHPAD_PAGE_GAP}px`;
                            pageBreak.style.marginTop = `${pageMargin.top}px`;
                            pageBreak.style.marginBottom = `${pageMargin.bottom}px`;
                            pageNumber++;
                            return pageBreak;
                            })
                        );
                        }
                        return DecorationSet.create(doc, decorations);
                    },
                },
                view(view) {
                    const borderLayer = document.createElement('div');
                    borderLayer.className = 'page-border-layer';
                    borderLayer.setAttribute('data-pm-ignore', 'true');
                    (view.dom.parentNode as HTMLElement).appendChild(borderLayer);

                    const updateBorders = () => {
                        borderLayer.innerHTML = '';
                        const { pageHeight, pageMargin } =
                        pluginKey.getState(view.state) as PaginationOptions;
                        const breaks = Array.from(view.dom.querySelectorAll<HTMLHRElement>('hr.page-break'));

                        let start = -pageMargin.top;
                        breaks.forEach((hr) => {
                            const top = start;
                            const height = pageHeight;
                            // const height = hr.offsetTop + pageMargin - start;
                            const div = document.createElement('div');
                            div.className = 'page-border';
                            div.style.top = `${top}px`;
                            div.style.height = `${height}px`;
                            borderLayer.appendChild(div);
                            start += pageHeight+SCRATCHPAD_PAGE_GAP;
                        });

                        const lastBorder = document.createElement('div');
                        lastBorder.className = 'page-border';
                        lastBorder.style.top = `${start}px`;
                        lastBorder.style.height = `${pageHeight - start}px`;
                        borderLayer.appendChild(lastBorder);
                        // console.log(borderLayer)
                    };

                    updateBorders();
                    return {
                        update: updateBorders,
                        destroy() { borderLayer.remove(); },
                    };
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
