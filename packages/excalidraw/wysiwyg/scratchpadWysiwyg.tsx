import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontSize from "tiptap-extension-font-size";
import Color from "@tiptap/extension-color";
// import { Pagination } from "tiptap-pagination-breaks"; 
import { Pagination } from "./pagination"; 
// import { PageBreak } from "./pageBreak";

import {
  KEYS,
  CLASSES,
  POINTER_BUTTON,
  isWritableElement,
  getFontString,
  getFontFamilyString,
  isTestEnv,
  getLineHeight,
  getVerticalOffset,
  FONT_FAMILY,
  SCRATCHPAD_PAGE_SIZES,
} from "@excalidraw/common";

import {
  getLineHeightInPx,
  isScratchpadElement,
  originalContainerCache,
  updateOriginalContainerCache,
} from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";
import { bumpVersion } from "@excalidraw/element";
import {
  getBoundTextElementId,
  getContainerElement,
  getTextElementAngle,
  redrawTextBoundingBox,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  computeContainerDimensionForBoundText,
  computeBoundTextPosition,
} from "@excalidraw/element";

import {
  isArrowElement,
  isBoundToContainer,
  isTextElement,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextElement,
  ExcalidrawScratchpadElement,
} from "@excalidraw/element/types";

import { actionSaveToActiveFile } from "../actions";

import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
} from "../actions/actionCanvas";

import type { JSONContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";

import { atom, editorJotaiStore } from "../editor-jotai";

export const activeScratchpadEditorAtom = atom<Editor | null>(null);
export const getScratchpadEditor = () =>
  editorJotaiStore.get(activeScratchpadEditorAtom);

import type App from "../components/App";
import type { AppState } from "../types";
import { findBreakOffsetForHeight, measureTiptapDoc, measureTiptapDocWithWidth } from "@excalidraw/element/parseTiptapDoc";
import FontFamily from "@tiptap/extension-font-family";
import { PageWrapper } from "./pageWrapper";
import { StyledHardBreak } from "./styledHardBreak";

const getTransform = (
  width: number,
  height: number,
  angle: number,
  appState: AppState,
  maxWidth: number,
  maxHeight: number,
) => {
  const { zoom } = appState;
  const degree = (180 * angle) / Math.PI;
  let translateX = (width * (zoom.value - 1)) / 2;
  let translateY = (height * (zoom.value - 1)) / 2;
  if (width > maxWidth && zoom.value !== 1) {
    translateX = (maxWidth * (zoom.value - 1)) / 2;
  }
  if (height > maxHeight && zoom.value !== 1) {
    translateY = (maxHeight * (zoom.value - 1)) / 2;
  }
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
};

type SubmitHandler = () => void;

import { Fragment, Slice, Node as PMNode, Mark } from "prosemirror-model";
// apply `mark` to all text nodes inside `slice`
function addMarkToSlice(slice: Slice, mark: Mark): Slice {
  const map = (fragment: Fragment): Fragment => {
    const children: PMNode[] = [];
    fragment.forEach(child => {
      let node = child;
      if (child.isText) {
        node = child.mark(mark.addToSet(child.marks));
      } else if (child.content.size) {
        node = child.copy(map(child.content));
      }
      children.push(node);
    });
    return Fragment.fromArray(children);
  };

  return new Slice(map(slice.content), slice.openStart, slice.openEnd);
}

export const scratchpadWysiwyg = ({
  id,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
  excalidrawContainer,
  containerSelector = ".excalidraw-textEditorContainer",
  app,
  autoSelect = true,
}: {
  id: ExcalidrawElement["id"];
  /**
   * textWysiwyg only deals with `originalText`
   *
   * Note: `text`, which can be wrapped and therefore different from `originalText`,
   *       is derived from `originalText`
   */
  onChange?: (nextDoc: JSONContent) => void;
  onSubmit: (args: { viaKeyboard: boolean; nextDoc: JSONContent }) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawScratchpadElement;
  canvas: HTMLCanvasElement;
  excalidrawContainer: HTMLDivElement | null;
  containerSelector?: string;
  app: App;
  autoSelect?: boolean;
}): SubmitHandler => {
  let pageEl: HTMLDivElement | null = null;
  const onPageScroll = (evt: Event) => {
    const el = app.scene.getElement(id);
    const page = evt.currentTarget as HTMLDivElement;
    if (el && isScratchpadElement(el)) {
      app.scene.mutateElement(el, { scrollTop: page.scrollTop });
    }
  };

  const textPropertiesUpdated = (
    updatedTextElement: ExcalidrawTextElement,
    editable: HTMLDivElement,
  ) => {
    if (!editable.style.fontFamily || !editable.style.fontSize) {
      return false;
    }
    const currentFont = editable.style.fontFamily.replace(/"/g, "");
    if (
      getFontFamilyString({ fontFamily: updatedTextElement.fontFamily }) !==
      currentFont
    ) {
      return true;
    }
    if (`${updatedTextElement.fontSize}px` !== editable.style.fontSize) {
      return true;
    }
    return false;
  };

  const updateWysiwygStyle = () => {
    const appState = app.state;
    const updatedElement = app.scene.getElement(id);
      if (!updatedElement) {
        return;
      }
      const elementsMap = app.scene.getNonDeletedElementsMap();
    
    

    if (isScratchpadElement(updatedElement)) {
      const page = pageEl ?? editable.querySelector<HTMLDivElement>(".page");
      if (page) {
        page.scrollTop = updatedElement.scrollTop;
        pageEl = page;
      }

      editable.style.setProperty(
        "--page-overflow",
        element.paginationEnabled ? "visible" : "auto",
      );

        const baseSize =
          updatedElement.pageSize && !updatedElement.paginationEnabled
            ? SCRATCHPAD_PAGE_SIZES[updatedElement.pageSize]
            : { width: updatedElement.width, height: updatedElement.height };

        const contentWidth =
          baseSize.width - updatedElement.margin.left - updatedElement.margin.right;
        const contentHeight =
          baseSize.height - updatedElement.margin.top - updatedElement.margin.bottom;

        const isEmptyDoc = !updatedElement.originalTiptapDoc.content?.length;
        const measuredHeight = isEmptyDoc
            ? contentHeight
            : measureTiptapDocWithWidth(
                updatedElement.originalTiptapDoc,
                contentWidth,
                {
                  fontFamily: updatedElement.fontFamily,
                  fontSize: updatedElement.fontSize,
                },
              ).height;
        const height = updatedElement.autoResize
          ? measuredHeight + updatedElement.margin.top + updatedElement.margin.bottom
          : baseSize.height;
        const width = baseSize.width;

        let coordX = updatedElement.x;
        let coordY = updatedElement.y;

        const font = getFontString({
          fontFamily: updatedElement.fontFamily,
          fontSize: updatedElement.fontSize,
        });

        const lineHeight = getLineHeight(updatedElement.fontFamily);

        const [viewportX, viewportY] = getViewportCoords(coordX, coordY);

        const editorMaxHeight = (appState.height - viewportY) / appState.zoom.value;



        Object.assign(editable.style, {
          left: `${viewportX}px`,
          top: `${viewportY}px`, 
          width: `${width}px`,
          height: `${height}px`,
          font,
          lineHeight,
          color: updatedElement.strokeColor,
          opacity: updatedElement.opacity / 100,
          filter: "var(--theme-filter)",
          transform: getTransform(
            updatedElement.width,
            updatedElement.height,
            app.state.scratchpadViewMode === "ideation"
              ? 0
              : updatedElement.angle,
            appState,
            updatedElement.width,
            editorMaxHeight,
          ),
          maxHeight: `${editorMaxHeight}px`,
        });
        app.scene.mutateElement(updatedElement, { x: coordX, y: coordY });
      } 
    else if (updatedElement && isTextElement(updatedElement)) {
      const updatedTextElement = updatedElement;
      let coordX = updatedTextElement.x;
      let coordY = updatedTextElement.y;
      const container = getContainerElement(
        updatedTextElement,
        app.scene.getNonDeletedElementsMap(),
      );

      let width = updatedTextElement.width;

      // set to element height by default since that's
      // what is going to be used for unbounded text
      let height = updatedTextElement.height;

      let maxWidth = updatedTextElement.width;
      let maxHeight = updatedTextElement.height;

      if (container && updatedTextElement.containerId) {
        if (isArrowElement(container)) {
          const boundTextCoords =
            LinearElementEditor.getBoundTextElementPosition(
              container,
              updatedTextElement as ExcalidrawTextElementWithContainer,
              elementsMap,
            );
          coordX = boundTextCoords.x;
          coordY = boundTextCoords.y;
        }
        const propertiesUpdated = textPropertiesUpdated(
          updatedTextElement,
          editable,
        );

        let originalContainerData;
        if (propertiesUpdated) {
          originalContainerData = updateOriginalContainerCache(
            container.id,
            container.height,
          );
        } else {
          originalContainerData = originalContainerCache[container.id];
          if (!originalContainerData) {
            originalContainerData = updateOriginalContainerCache(
              container.id,
              container.height,
            );
          }
        }

        maxWidth = getBoundTextMaxWidth(container, updatedTextElement);
        maxHeight = getBoundTextMaxHeight(
          container,
          updatedTextElement as ExcalidrawTextElementWithContainer,
        );

        // autogrow container height if text exceeds
        if (!isArrowElement(container) && height > maxHeight) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );

          app.scene.mutateElement(container, { height: targetContainerHeight });
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          !isArrowElement(container) &&
          container.height > originalContainerData.height &&
          height < maxHeight
        ) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );
          app.scene.mutateElement(container, { height: targetContainerHeight });
        } else {
          const { y } = computeBoundTextPosition(
            container,
            updatedTextElement as ExcalidrawTextElementWithContainer,
            elementsMap,
          );
          coordY = y;
        }
      }
      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);

      if (!container) {
        maxWidth = (appState.width - 8 - viewportX) / appState.zoom.value;
        width = Math.min(width, maxWidth);
      } else {
        width += 0.5;
      }

      // add 5% buffer otherwise it causes wysiwyg to jump
      height *= 1.05;

      const font = getFontString(updatedTextElement);
      const { textAlign, verticalAlign } = updatedTextElement;
      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;
      Object.assign(editable.style, {
        width: `${width}px`,
        height: `${height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          width,
          height,
          getTextElementAngle(updatedTextElement, container),
          appState,
          maxWidth,
          editorMaxHeight,
        ),
        textAlign,
        verticalAlign,
        color: updatedTextElement.strokeColor,
        opacity: updatedTextElement.opacity / 100,
        filter: "var(--theme-filter)",
        maxHeight: `${editorMaxHeight}px`,
      });
      editable.scrollTop = 0;
      // For some reason updating font attribute doesn't set font family
      // hence updating font family explicitly for test environment
      if (isTestEnv()) {
        editable.style.fontFamily = getFontFamilyString(updatedTextElement);
      }

      app.scene.mutateElement(updatedTextElement, { x: coordX, y: coordY });
    }
  };

  const editable = document.createElement("div");
  editable.id = "editable";
  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.dataset.type = "wysiwyg";
  editable.classList.add("excalidraw-wysiwyg");


  let whiteSpace = "pre";
  let wordBreak = "normal";

  if (isBoundToContainer(element) || !element.autoResize) {
    whiteSpace = "pre-wrap";
    wordBreak = "break-word";
  }
  const lineHeight = getLineHeight(element.fontFamily);
  const font = getFontString({
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
  });

  Object.assign(editable.style, {
    position: "absolute",
    // display: "inline-block",
    display: "inline-table",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    overflow: "hidden",
    font,
    lineHeight,
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
    wordBreak,
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    // background: element.backgroundImage
    //   ? `url(${element.backgroundImage}) no-repeat center / 100% 100%`
    //   : "transparent",
    background: "transparent",
    overflowWrap: "break-word",
    boxSizing: "content-box",
    top: `${getViewportCoords(element.x, element.y)[1]}px`,
  });

  editable.style.setProperty(
    "--page-padding",
    `${element.margin.top}px ${element.margin.right}px ` +
    `${element.margin.bottom}px ${element.margin.left}px`
  );
  editable.style.setProperty(
    "--page-overflow",
    element.paginationEnabled ? "visible" : "auto",
  );
  updateWysiwygStyle();

  let editor: ReturnType<typeof useEditor> | null = null;
  // let editor: Editor | null = null;
  let prevDoc = element.originalTiptapDoc;
  const changeHistory = [...(element.changeHistory || [])];

  const { width: pageW, height: pageH } = element.pageSize
    ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
    : { width: element.width, height: element.height };
  const pageMargin = { ...element.margin };

  const ScratchpadEditor = () => {
    const pageSize = element.pageSize
      ? SCRATCHPAD_PAGE_SIZES[element.pageSize]
      : { width: element.width, height: element.height };
    
    const pageExtensions = [
      ...(element.paginationEnabled
        ? [
            Pagination.configure({
              pageHeight: pageSize.height,
              pageWidth: pageSize.width,
              pageMargin,
            }),
          ]
        : []),
      // PageWrapper.configure({ pageHeight: pageSize.height }),
      // PageBreak,
    ];
    const ed = useEditor({
      extensions: [StarterKit.configure({ hardBreak: false }), TextStyle, Color, FontFamily, FontSize, StyledHardBreak,
        ...pageExtensions
      ],
      content: prevDoc,
      editorProps: {
        handlePaste(view, event, slice) {
          console.log(slice)
          const fontName =
            Object.entries(FONT_FAMILY).find(([, id]) =>
              id === app.state.currentItemFontFamily)?.[0] ?? "Nunito";

          const mark = view.state.schema.marks.textStyle.create({
            fontFamily: fontName,
            fontSize: `${app.state.currentItemFontSize}px`,
          });

          const patched = addMarkToSlice(slice, mark);
          view.dispatch(view.state.tr.replaceSelection(patched));
          return true;
        },
      },
      onCreate: () => {
        // page wrapper exists only after the editor mounts
        refreshPageElement();
      },
      onUpdate: ({ editor: ed }) => {
        let doc = ed.getJSON();
        
        if (onChange) {
          onChange(doc);
        }
        changeHistory.push({ from: prevDoc, to: doc, timestamp: Date.now() });
        prevDoc = doc;
        // console.log(doc)
        updateWysiwygStyle();
        refreshPageElement();
      },
    }, [element.paginationEnabled, element.pageSize],);

    useEffect(() => {
      if (ed) {
        editor = ed as Editor;
        app.updateEditorAtom(activeScratchpadEditorAtom, ed);
        if (autoSelect) {
          ed.view.focus();
        }
        const currentFontName =
          Object.entries(FONT_FAMILY).find(([, id]) => id === app.state.currentItemFontFamily)?.[0];
        
        let doc = ed.getJSON();
        const chain = ed.chain();
        // if (!prevDoc?.content?.length) {
          chain
            .setFontFamily(currentFontName ?? "Nunito")
            .setFontSize(`${app.state.currentItemFontSize}px`);
        // }
        chain.setColor(element.strokeColor).run();
      }
      return () => {
        app.updateEditorAtom(activeScratchpadEditorAtom, null);
      };
    }, [ed]);

    return <EditorContent editor={ed} />;
  };

  const root = createRoot(editable);
  // console.log(root)
  root.render(<ScratchpadEditor />);

  const refreshPageElement = () => {
    const page = editable.querySelector<HTMLDivElement>(".page");
    if (page !== pageEl) {
      if (pageEl) {
        pageEl.removeEventListener("scroll", onPageScroll);
      }
      pageEl = page;
      if (pageEl) {
        const current = app.scene.getElement(id);
        pageEl.scrollTop =
          current && isScratchpadElement(current)
            ? current.scrollTop
            : element.scrollTop;
        pageEl.addEventListener("scroll", onPageScroll);
      }
    }
  };

  // wait for the editor DOM to mount so `.page` exists
  requestAnimationFrame(() => {
    refreshPageElement();
  });

  editable.onkeydown = (event) => {
    if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionZoomOut.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomOut);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionResetZoom.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionResetZoom);
      updateWysiwygStyle();
    } else if (actionDecreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionDecreaseFontSize);
    } else if (actionIncreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionIncreaseFontSize);
    } else if (event[KEYS.CTRL_OR_CMD] && event.key === KEYS.A) {
      // keep selection inside the scratchpad editor
      event.preventDefault();
      event.stopPropagation();
      editor?.commands.selectAll();
    } else if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (actionSaveToActiveFile.keyTest(event)) {
      event.preventDefault();
      handleSubmit();
      app.actionManager.executeAction(actionSaveToActiveFile);
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      submittedViaKeyboard = true;
      handleSubmit();
    }
  };

  // indentation helpers removed for tiptap editor

  const stopEvent = (event: Event) => {
    if (event.target instanceof HTMLCanvasElement) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // using a state variable instead of passing it to the handleSubmit callback
  // so that we don't need to create separate a callback for event handlers
  let submittedViaKeyboard = false;
  const handleSubmit = () => {
    // prevent double submit
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    // cleanup must be run before onSubmit otherwise when app blurs the wysiwyg
    // it'd get stuck in an infinite loop of blur→onSubmit after we re-focus the
    // wysiwyg on update
    cleanup();
    const updateElement = app.scene.getElement(
      element.id,
    ) as ExcalidrawTextElement;
    if (!updateElement) {
      return;
    }
    const container = getContainerElement(
      updateElement,
      app.scene.getNonDeletedElementsMap(),
    );

    if (container) {
      if (editor?.getText().trim()) {
        const boundTextElementId = getBoundTextElementId(container);
        if (!boundTextElementId || boundTextElementId !== element.id) {
          app.scene.mutateElement(container, {
            boundElements: (container.boundElements || []).concat({
              type: "text",
              id: element.id,
            }),
          });
        } else if (isArrowElement(container)) {
          // updating an arrow label may change bounds, prevent stale cache:
          bumpVersion(container);
        }
      } else {
        app.scene.mutateElement(container, {
          boundElements: container.boundElements?.filter(
            (ele) =>
              !isTextElement(
                ele as ExcalidrawTextElement | ExcalidrawLinearElement,
              ),
          ),
        });
      }

      redrawTextBoundingBox(updateElement, container, app.scene);
    }

    onSubmit({
      viaKeyboard: submittedViaKeyboard,
      nextDoc: prevDoc,
    });
  };

  const cleanup = () => {
    // remove events to ensure they don't late-fire
    editable.onblur = null;
    editable.onkeydown = null;

    if (observer) {
      observer.disconnect();
    }

    window.removeEventListener("resize", updateWysiwygStyle);
    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", bindBlurEvent);
    window.removeEventListener("blur", handleSubmit);
    window.removeEventListener("beforeunload", handleSubmit);
    unbindUpdate();
    unbindOnScroll();
    if (pageEl) {
      pageEl.removeEventListener("scroll", onPageScroll);
    }

    root.unmount();
    editable.remove();
    app.updateEditorAtom(activeScratchpadEditorAtom, null);
  };

  const bindBlurEvent = (event?: MouseEvent) => {
    window.removeEventListener("pointerup", bindBlurEvent);
    // Deferred so that the pointerdown that initiates the wysiwyg doesn't
    // trigger the blur on ensuing pointerup.
    // Also to handle cases such as picking a color which would trigger a blur
    // in that same tick.
    const target = event?.target;

    const isPropertiesTrigger =
      target instanceof HTMLElement &&
      target.classList.contains("properties-trigger");

    setTimeout(() => {
      if (app.state.scratchpadViewMode !== "ideation") {
        editable.onblur = handleSubmit;
      }

      // case: clicking on the same property → no change → no update → no focus
      if (!isPropertiesTrigger) {
        editor?.view.focus();
      }
    });
  };

  const temporarilyDisableSubmit = () => {
    if (app.state.scratchpadViewMode === "ideation") {
      return;
    }
    editable.onblur = null;
    window.addEventListener("pointerup", bindBlurEvent);
    // handle edge-case where pointerup doesn't fire e.g. due to user
    // alt-tabbing away
    window.addEventListener("blur", handleSubmit);
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    const target = event?.target;

    // panning canvas
    if (event.button === POINTER_BUTTON.WHEEL) {
      // trying to pan by clicking inside text area itself -> handle here
      if (target instanceof HTMLTextAreaElement) {
        event.preventDefault();
        app.handleCanvasPanUsingWheelOrSpaceDrag(event);
      }
      temporarilyDisableSubmit();
      return;
    }

    const isPropertiesTrigger =
      target instanceof HTMLElement &&
      target.classList.contains("properties-trigger");

    if (
      ((event.target instanceof HTMLElement ||
        event.target instanceof SVGElement) &&
        event.target.closest(
          `.${CLASSES.SHAPE_ACTIONS_MENU}, .${CLASSES.ZOOM_ACTIONS}`,
        ) &&
        !isWritableElement(event.target)) ||
      isPropertiesTrigger
    ) {
      temporarilyDisableSubmit();
    } else if (
      event.target instanceof HTMLCanvasElement &&
      // Vitest simply ignores stopPropagation, capture-mode, or rAF
      // so without introducing crazier hacks, nothing we can do
      !isTestEnv()
    ) {
      // On mobile, blur event doesn't seem to always fire correctly,
      // so we want to also submit on pointerdown outside the wysiwyg.
      // Done in the next frame to prevent pointerdown from creating a new text
      // immediately (if tools locked) so that users on mobile have chance
      // to submit first (to hide virtual keyboard).
      // Note: revisit if we want to differ this behavior on Desktop
      if (app.state.scratchpadViewMode !== "ideation") {
        requestAnimationFrame(() => {
          handleSubmit();
        });
      }
    }
  };

  // handle updates of textElement properties of editing element
  const unbindUpdate = app.scene.onUpdate(() => {
    updateWysiwygStyle();
    const isPopupOpened = !!document.activeElement?.closest(
      ".properties-content",
    );
    if (!isPopupOpened) {
      editor?.view.focus();
    }
  });

  const unbindOnScroll = app.onScrollChangeEmitter.on(() => {
    updateWysiwygStyle();
  });

  // ---------------------------------------------------------------------------

  let isDestroyed = false;

  // if (autoSelect) {
  //   // select on init (focusing is done separately inside the bindBlurEvent()
  //   // because we need it to happen *after* the blur event from `pointerdown`)
  //   editor?.commands.selectAll();
  // }
  bindBlurEvent();

  // reposition wysiwyg in case of canvas is resized. Using ResizeObserver
  // is preferred so we catch changes from host, where window may not resize.
  let observer: ResizeObserver | null = null;
  if (canvas && "ResizeObserver" in window) {
    observer = new window.ResizeObserver(() => {
      updateWysiwygStyle();
    });
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", updateWysiwygStyle);
  }

  editable.onpointerdown = (event) => event.stopPropagation();

  // rAF (+ capture to by doubly sure) so we don't catch te pointerdown that
  // triggered the wysiwyg
  requestAnimationFrame(() => {
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
  });
  window.addEventListener("beforeunload", handleSubmit);
  const target = excalidrawContainer?.querySelector(containerSelector);
  target?.appendChild(editable);

  return handleSubmit;
};
