import { getFontString } from "@excalidraw/common";

import { newElementWith, updateBoundElements } from "@excalidraw/element";
import { measureText } from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties } from "../types";

export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown, app: AppClassProperties) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      !selectedElements[0].autoResize
    );
  },
  perform: (elements, appState, _, app) => {
  const selectedElements = getSelectedElements(elements, appState);

    const updatedElements = elements.map((element) => {
      if (element.id === selectedElements[0].id && isTextElement(element)) {
        const metrics = measureText(
          element.originalText,
          getFontString(element),
          element.lineHeight,
        );

        const updated = newElementWith(element, {
          autoResize: true,
          width: metrics.width,
          height: metrics.height,
          text: element.originalText,
        });

        updateBoundElements(updated, app.scene, {
          newSize: { width: metrics.width, height: metrics.height },
        });

        return updated;
      }
      return element;
    });

    return {
      appState,
      elements: updatedElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
