import { register } from "./register";
import {
  getSelectedElements,
  newElementWith,
  isScratchpadElement,
} from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import type { ExcalidrawScratchpadElement } from "@excalidraw/element/types";

export const actionEnterIdeationView = register({
  name: "enterIdeationView",
  trackEvent: false,
  label: "labels.enterIdeationView",
  predicate(elements, appState) {
    const sel = getSelectedElements(elements, appState);
    return sel.length === 1 && isScratchpadElement(sel[0]);
  },
  perform(elements, appState) {
    const [scratchpad] = getSelectedElements(
      elements,
      appState,
    ) as [ExcalidrawScratchpadElement];
    return {
        elements: elements.map((el) =>
            el.id === scratchpad.id
            ? newElementWith(el as ExcalidrawScratchpadElement, {
                paginationEnabled: true,
                })
            : el,
        ),
        appState: {
            ...appState,
            scratchpadViewMode: "ideation",
            ideationScratchpadId: scratchpad.id,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
  },
});
