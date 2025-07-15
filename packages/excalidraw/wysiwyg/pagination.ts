'use strict';

var core = require('@tiptap/core');
var prosemirrorState = require('prosemirror-state');
var prosemirrorView = require('prosemirror-view');
import { Decoration, DecorationSet } from 'prosemirror-view';

export const Pagination = core.Extension.create({
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
            setPaginationOptions: (options) => ({ tr, dispatch }) => {
                if (dispatch) {
                    tr.setMeta('paginationOptions', options);
                }
                return true;
            },
        };
    },
    onUpdate() {
        // Apply the page width and margin to the editor's container
        const editorContainer = this.editor.view.dom.closest('.ProseMirror');
        if (editorContainer) {
            const htmlElement = editorContainer; // Cast to HTMLElement
            htmlElement.style.width = `${this.options.pageWidth}px`;
            htmlElement.style.margin = `${this.options.pageMargin}px auto`;
        }
    },
    addProseMirrorPlugins() {
        const pluginKey = new prosemirrorState.PluginKey('pagination');
        return [
            new prosemirrorState.Plugin({
                key: pluginKey,
                state: {
                    init: () => ({ ...this.options }),
                    apply: (tr, value) => {
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
                        const options = pluginKey.getState(state);
                        const { pageHeight, pageMargin, showPageNumber, label } = options;
                        const effectivePageHeight = pageHeight - 2 * pageMargin;
                        const createPageBreak = (pos) => {
                            return prosemirrorView.Decoration.widget(pos, () => {
                                const pageBreak = document.createElement('div');
                                pageBreak.className = 'page-break';
                                pageBreak.style.cssText = `
                  height: 20px;
                  width: 100%;
                  border-top: 1px dashed #ccc;
                  margin: 10px 0;
                  position: relative;
                `;
                                pageBreak.setAttribute('data-page-number', String(pageNumber));
                                if (showPageNumber) {
                                    const pageIndicator = document.createElement('span');
                                    pageIndicator.className = 'page-number';
                                    pageIndicator.textContent = `${label || 'Page'} ${pageNumber}`;
                                    pageIndicator.style.cssText = `
                    position: absolute;
                    right: 0;
                    top: -10px;
                    font-size: 12px;
                    color: #666;
                    background: white;
                    padding: 0 4px;
                  `;
                                    pageBreak.appendChild(pageIndicator);
                                }
                                pageNumber++;
                                return pageBreak;
                            });
                        };
                        doc.descendants((node, pos) => {
                            if (!node.isBlock)
                                return;
                            const nodeDOM = this.editor.view.nodeDOM(pos);
                            if (!(nodeDOM instanceof HTMLElement))
                                return;
                            const isList = node.type.name === 'bulletList' ||
                                node.type.name === 'orderedList';
                            const isListItem = node.type.name === 'listItem';
                            // Calculate node height
                            const nodeHeight = isListItem
                                ? calculateListItemHeight(nodeDOM)
                                : nodeDOM.offsetHeight;
                            if (nodeHeight === 0)
                                return;
                            // Handle list items
                            if (isList) {
                                return;
                            }

                            // Paginate individual list items
                            if (isListItem) {
                                if (currentPageHeight + nodeHeight > effectivePageHeight) {
                                    decorations.push(createPageBreak(pos));
                                    currentPageHeight = nodeHeight;
                                } else {
                                    currentPageHeight += nodeHeight;
                                }
                                return;
                            }
                            // Handle non-list blocks
                            if (currentPageHeight + nodeHeight > effectivePageHeight) {
                                decorations.push(createPageBreak(pos));
                                currentPageHeight = nodeHeight;
                            } else {
                                currentPageHeight += nodeHeight;
                            }
                        });
                        return prosemirrorView.DecorationSet.create(doc, decorations);
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
function calculateListItemHeight(element) {
    const style = window.getComputedStyle(element);
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return (element.offsetHeight + marginTop + marginBottom + paddingTop + paddingBottom);
}

exports.Pagination = Pagination;
//# sourceMappingURL=index.js.map
