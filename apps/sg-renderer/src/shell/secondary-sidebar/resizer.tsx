import { ResizeHandle } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  clampWidth,
  getWidthBounds,
  shouldCloseFromPointer,
  widthFromKey,
  widthFromPointer,
  type WidthBounds,
} from "./sizing";

const widthProperty = "--secondary-sidebar-width";

type DragSession = {
  pointerId: number;
  startX: number;
  startWidth: number;
  nextWidth: number;
  limits: WidthBounds;
};

type DragResolution = "cancel" | "commit";

export function Layout({
  children,
  panel,
  onClose,
}: {
  children: ReactNode;
  panel?: ReactNode;
  onClose?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const paneId = useId();
  const hasPanel = panel !== undefined && panel !== null;

  return (
    <div ref={container} {...stylex.props(styles.layout, hasPanel && styles.withPanel)}>
      <div {...stylex.props(styles.surfaceSlot)}>{children}</div>
      {hasPanel && (
        <>
          <Resizer container={container} pane={pane} paneId={paneId} onClose={onClose} />
          <div ref={pane} id={paneId} {...stylex.props(styles.surfaceSlot)}>
            {panel}
          </div>
        </>
      )}
    </div>
  );
}

function Resizer({
  container,
  pane,
  paneId,
  onClose,
}: {
  container: RefObject<HTMLDivElement | null>;
  pane: RefObject<HTMLDivElement | null>;
  paneId: string;
  onClose: (() => void) | undefined;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<DragSession | null>(null);
  const animationFrame = useRef<number | null>(null);

  const applyWidth = (width: number) => {
    const containerElement = container.current;
    const handleElement = handle.current;

    if (!containerElement || !handleElement) {
      return;
    }

    containerElement.style.setProperty(widthProperty, `${width}px`);
    handleElement.setAttribute("aria-valuenow", String(width));
    handleElement.setAttribute("aria-valuetext", `${width} pixels`);
  };

  const applyLimits = (limits: WidthBounds) => {
    const handleElement = handle.current;
    if (!handleElement) {
      return;
    }

    handleElement.setAttribute("aria-valuemin", String(limits.minimum));
    handleElement.setAttribute("aria-valuemax", String(limits.maximum));
  };

  const cancelScheduledRender = () => {
    if (animationFrame.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
  };

  const clearDragPresentation = () => {
    const handleElement = handle.current;
    if (handleElement) {
      delete handleElement.dataset.resizing;
    }
  };

  const finishDragging = (event: PointerEvent<HTMLDivElement>, resolution: DragResolution) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    cancelScheduledRender();
    let nextWidth = current.startWidth;
    let closePanel = false;
    if (resolution === "commit") {
      nextWidth = widthFromPointer(
        current.startWidth,
        current.startX,
        event.clientX,
        current.limits,
      );
      if (onClose) {
        closePanel = shouldCloseFromPointer(
          current.startWidth,
          current.startX,
          event.clientX,
          current.limits,
        );
      }
    }

    drag.current = null;
    applyWidth(nextWidth);
    clearDragPresentation();

    const handleElement = handle.current;
    if (handleElement?.hasPointerCapture(event.pointerId)) {
      handleElement.releasePointerCapture(event.pointerId);
    }

    if (closePanel && onClose) {
      onClose();
    }
  };

  useLayoutEffect(() => {
    const containerElement = container.current;
    const paneElement = pane.current;

    if (!containerElement || !paneElement) {
      return;
    }

    const synchronize = () => {
      if (drag.current) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const containerWidth = containerElement.getBoundingClientRect().width;
      const limits = getWidthBounds(viewportWidth, containerWidth);
      const nextWidth = clampWidth(paneElement.getBoundingClientRect().width, limits);
      applyLimits(limits);
      applyWidth(nextWidth);
    };

    synchronize();
    const observer = new ResizeObserver(synchronize);
    observer.observe(containerElement);

    return () => {
      observer.disconnect();
      cancelScheduledRender();
      drag.current = null;
      clearDragPresentation();
    };
  }, [container, pane]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    const containerElement = container.current;
    const paneElement = pane.current;
    const handleElement = handle.current;
    if (!containerElement || !paneElement || !handleElement) {
      return;
    }

    event.preventDefault();
    const viewportWidth = window.innerWidth;
    const containerWidth = containerElement.getBoundingClientRect().width;
    const limits = getWidthBounds(viewportWidth, containerWidth);
    const startWidth = clampWidth(paneElement.getBoundingClientRect().width, limits);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      nextWidth: startWidth,
      limits,
    };
    handleElement.dataset.resizing = "";
    handleElement.focus();
    handleElement.setPointerCapture(event.pointerId);
    applyLimits(limits);
    applyWidth(startWidth);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    current.nextWidth = widthFromPointer(
      current.startWidth,
      current.startX,
      event.clientX,
      current.limits,
    );

    if (animationFrame.current !== null) {
      return;
    }

    animationFrame.current = window.requestAnimationFrame(() => {
      animationFrame.current = null;
      const active = drag.current;
      if (active) {
        applyWidth(active.nextWidth);
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const containerElement = container.current;
    const paneElement = pane.current;
    if (!containerElement || !paneElement) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const containerWidth = containerElement.getBoundingClientRect().width;
    const limits = getWidthBounds(viewportWidth, containerWidth);
    const nextWidth = widthFromKey(event.key, paneElement.getBoundingClientRect().width, limits);
    if (nextWidth === undefined) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    applyLimits(limits);
    applyWidth(nextWidth);
  };

  return (
    <ResizeHandle
      ref={handle}
      orientation="vertical"
      aria-label="Resize sidebar"
      aria-controls={paneId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finishDragging(event, "commit")}
      onPointerCancel={(event) => finishDragging(event, "cancel")}
      onLostPointerCapture={(event) => finishDragging(event, "cancel")}
      onKeyDown={onKeyDown}
    />
  );
}

const styles = stylex.create({
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
  },
  withPanel: {
    gridTemplateColumns:
      "minmax(0, 1fr) auto minmax(0, min(var(--secondary-sidebar-width, min(20rem, 35vw)), 60%))",
  },
  surfaceSlot: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    paddingTop: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
      "@media (max-width: 480px)": 0,
    },
    paddingBottom: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
    },
  },
});
