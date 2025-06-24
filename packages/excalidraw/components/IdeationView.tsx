import { useApp, useExcalidrawAppState } from "./App";
import { ElementCanvasButtons } from "./ElementCanvasButtons";
import { ElementCanvasButton } from "./MagicButton";
import { fullscreenIcon } from "./icons";


export const IdeationView = () => {
  const appState = useExcalidrawAppState();
  const app = useApp();

  if (
    appState.scratchpadViewMode !== "ideation" ||
    !appState.ideationScratchpadId
  ) {
    return null;
  }

  const el = app.scene.getElement(appState.ideationScratchpadId);
  if (!el) {
    return null;
  }

  return (
    <div className="ideation-view">
      <div className="ideation-content"></div>
      <ElementCanvasButtons
        element={el}
        elementsMap={app.scene.getNonDeletedElementsMap()}
      >
        <ElementCanvasButton
          title="Full mode"
          icon={fullscreenIcon}
          checked={false}
          onChange={() => {}}
        />
      </ElementCanvasButtons>
    </div>
  );
};
