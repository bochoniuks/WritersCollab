import { Extension, CommandProps } from '@tiptap/core';
import {
  Plugin,
  PluginKey,
  EditorState,
  Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';
import { findBreakOffsetForHeight } from '@excalidraw/element/parseTiptapDoc';
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_SCRATCHPAD_PAGE_MARGIN, SCRATCHPAD_PAGE_GAP } from '@excalidraw/common';
import { HeightData, heightTrackingPluginKey } from './heightTrackingPlugin';

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
            const htmlElement = editorContainer;
            const { pageWidth, pageMargin } = this.options;
            const innerWidth = pageWidth - pageMargin.left - pageMargin.right;
            htmlElement.style.width = `${innerWidth}px`;
            htmlElement.style.margin = '0';
            htmlElement.style.paddingTop = `${pageMargin.top}px`;
            htmlElement.style.paddingBottom = `${pageMargin.bottom}px`;
            htmlElement.style.paddingLeft = `${pageMargin.left}px`;
            htmlElement.style.paddingRight = `${pageMargin.right}px`;
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
                        const effectivePageHeight = pageHeight - (pageMargin.top + pageMargin.bottom);
                        
                        const breakPositions: number[] = [];
                        const heightData = heightTrackingPluginKey.getState(state) as HeightData;
                        let accumulated = 0;
                        let pageC = 1
                        console.log("------------------------------------")
                        state.doc.descendants((node, position) => {
                            if (!node.isBlock) {
                                return true;
                            }
                            const nodeHeight = heightData?.get(node) ?? 0;

                            if (position !== 0 && accumulated + nodeHeight > effectivePageHeight) {
                                let hasBlockChildren = false;
                                node.forEach(child => {
                                    if (child.isBlock) {
                                        hasBlockChildren = true;
                                    }
                                });

                                if (hasBlockChildren) {
                                    let innerAccum = accumulated;
                                    node.forEach((child, offset) => {
                                        const childHeight = heightData?.get(child) ?? 0;
                                        if (child.isBlock && innerAccum + childHeight > effectivePageHeight) {
                                            breakPositions.push(position + offset + 1);
                                            innerAccum = childHeight;
                                        } else {
                                            innerAccum += childHeight;
                                        }
                                    });
                                    accumulated = innerAccum;
                                    return false; // prevent the traversal from double-processing children
                                }

                                breakPositions.push(position);
                                accumulated = nodeHeight;
                            } else {
                                accumulated += nodeHeight;
                            }
                        });
                        

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
                                    // console.log(pageBreak)
                                    pageNumber++;
                                    return pageBreak;
                                })
                            );
                        }
                        return DecorationSet.create(doc, decorations);
                    },
                },
                view(view) {
                    const {  pageWidth, pageMargin } =
                        pluginKey.getState(view.state) as PaginationOptions;
                    const borderLayer = document.createElement('div');
                    borderLayer.className = 'page-border-layer';
                    Object.assign(borderLayer.style, {
                        width: `${pageWidth + (pageMargin.left+pageMargin.right)}px`,
                    })
                    borderLayer.setAttribute('data-pm-ignore', 'true');
                    (view.dom.parentNode as HTMLElement).appendChild(borderLayer);

                    const updateBorders = () => {
                        borderLayer.innerHTML = '';
                        const { pageHeight, pageMargin } =
                        pluginKey.getState(view.state) as PaginationOptions;
                        const breaks = Array.from(view.dom.querySelectorAll<HTMLHRElement>('hr.page-break'));

                        let start = 0;
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


export const runPagination = (view: EditorView) => {      // new helper
  view.dispatch(view.state.tr.setMeta('paginationOptions', {}));
};

function calculateListItemHeight(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return (element.offsetHeight + marginTop + marginBottom + paddingTop + paddingBottom);
}
