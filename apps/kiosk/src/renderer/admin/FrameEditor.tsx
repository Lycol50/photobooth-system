import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  CropIcon as Crop,
  FilePngIcon as FilePng,
  FloppyDiskIcon as FloppyDisk,
  FilmStripIcon as FilmStrip,
} from '@phosphor-icons/react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Rnd } from 'react-rnd';

import type { CropMode, FrameLayout, FrameSlot, FrameSummary } from '@grace-booth/shared';

import { Button } from '../components/Button';
import { LOCAL_FIXTURES, mockPhotoFor } from '../local-fixtures';

type FrameEditorProps = {
  busy?: boolean | undefined;
  error?: string | null | undefined;
  frame?: FrameSummary | undefined;
  frames?: [FrameSummary, FrameSummary] | undefined;
  onChooseFrame: (optionIndex: 1 | 2) => void;
  onSave: (frameId: string, slots: FrameLayout, expectedRevision: number) => void;
  status?: string | null | undefined;
};

type StageSize = {
  height: number;
  width: number;
};

type SlotDraft = {
  frameKey: string;
  slots: FrameLayout;
};

function constrainSlot(slot: FrameSlot): FrameSlot {
  const width = Math.max(0.05, Math.min(1, slot.width));
  const height = Math.max(0.05, Math.min(1, slot.height));
  const x = Math.max(0, Math.min(1 - width, slot.x));
  const y = Math.max(0, Math.min(1 - height, slot.y));
  return { ...slot, x, y, width, height };
}

function percent(value: number): string {
  return (value * 100).toFixed(1);
}

function parsePercent(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : fallback;
}

export function FrameEditor({
  busy = false,
  error,
  frame,
  frames,
  onChooseFrame,
  onSave,
  status,
}: FrameEditorProps) {
  const [activeCollageIndex, setActiveCollageIndex] = useState<1 | 2>(1);

  const frame1 = frames?.[0] ?? frame;
  const frame2 = frames?.[1] ?? frame;
  const activeFrame = activeCollageIndex === 1 ? frame1 : (frame2 ?? frame1);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 540, height: 720 });
  const [draft1, setDraft1] = useState<SlotDraft | null>(null);
  const [draft2, setDraft2] = useState<SlotDraft | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(1);

  const frameKey1 = frame1 ? `${frame1.id}:${frame1.revision}` : '';
  const frameKey2 = frame2 ? `${frame2.id}:${frame2.revision}` : '';
  const slots1 = draft1?.frameKey === frameKey1 ? draft1.slots : (frame1?.slots ?? []);
  const slots2 = draft2?.frameKey === frameKey2 ? draft2.slots : (frame2?.slots ?? []);
  const currentSlots = activeCollageIndex === 1 ? slots1 : slots2;

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };

    update();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeFrame?.height, activeFrame?.width, activeCollageIndex]);

  const selectedSlot = useMemo(
    () => currentSlots.find((slot) => slot.slotIndex === selectedIndex) ?? currentSlots[0],
    [selectedIndex, currentSlots],
  );

  const updateSlot = (slotIndex: number, update: Partial<FrameSlot>) => {
    const nextSlots = currentSlots.map((slot) =>
      slot.slotIndex === slotIndex ? constrainSlot({ ...slot, ...update }) : slot,
    );
    if (activeCollageIndex === 1) {
      setDraft1({ frameKey: frameKey1, slots: nextSlots });
    } else {
      setDraft2({ frameKey: frameKey2, slots: nextSlots });
    }
  };

  const updateSelectedPercent = (field: 'x' | 'y' | 'width' | 'height', value: string) => {
    if (!selectedSlot) {
      return;
    }
    updateSlot(selectedSlot.slotIndex, {
      [field]: parsePercent(value, selectedSlot[field]),
    });
  };

  const setCropMode = (cropMode: CropMode) => {
    if (selectedSlot) {
      updateSlot(selectedSlot.slotIndex, { cropMode });
    }
  };

  const resetSelected = () => {
    const persisted = activeFrame?.slots.find((slot) => slot.slotIndex === selectedIndex);
    if (persisted) {
      updateSlot(selectedIndex, persisted);
    }
  };

  const nudgeSelected = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !selectedSlot) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 0.02 : 0.005;
    updateSlot(selectedIndex, {
      x: selectedSlot.x + direction[0] * step,
      y: selectedSlot.y + direction[1] * step,
    });
  };

  const handleSave = () => {
    if (!activeFrame) return;
    onSave(activeFrame.id, currentSlots, activeFrame.revision);
  };

  return (
    <div className="frame-editor" data-testid="frame-editor">
      <header className="admin-page-header">
        <div>
          <h1 data-screen-heading tabIndex={-1}>
            FRAME EDITOR
          </h1>
          <p>Configure two independent collage designs and their three-photo slot geometry.</p>
        </div>
        <div className="admin-page-header__actions">
          <div className="collage-tab-group" role="tablist" aria-label="Collage options to edit">
            <button
              className={`collage-tab-btn ${activeCollageIndex === 1 ? 'is-active' : ''}`}
              onClick={() => setActiveCollageIndex(1)}
              role="tab"
              aria-selected={activeCollageIndex === 1}
              type="button"
              data-testid="tab-collage-1"
            >
              Collage 1 · M.A.T.
            </button>
            <button
              className={`collage-tab-btn ${activeCollageIndex === 2 ? 'is-active' : ''}`}
              onClick={() => setActiveCollageIndex(2)}
              role="tab"
              aria-selected={activeCollageIndex === 2}
              type="button"
              data-testid="tab-collage-2"
            >
              Collage 2 · Anniversary
            </button>
          </div>
          <Button
            icon={<FilePng aria-hidden="true" weight="bold" />}
            onClick={() => onChooseFrame(activeCollageIndex)}
            variant="secondary"
          >
            Replace frame
          </Button>
          <Button
            icon={<FloppyDisk aria-hidden="true" weight="bold" />}
            loading={busy}
            onClick={handleSave}
          >
            Save configuration
          </Button>
        </div>
      </header>
      <div className="frame-editor__workspace">
        <section className="frame-stage-wrapper" aria-label="Visual frame layout preview">
          <div className="frame-stage-card">
            <div
              className="frame-stage"
              ref={stageRef}
              style={{
                aspectRatio: `${activeFrame?.width ?? 1200} / ${activeFrame?.height ?? 3600}`,
              }}
            >
              {currentSlots.map((slot) => {
                const selected = slot.slotIndex === selectedIndex;
                return (
                  <Rnd
                    bounds="parent"
                    className={`frame-slot${selected ? ' is-selected' : ''}`}
                    key={slot.slotIndex}
                    minHeight={40}
                    minWidth={40}
                    onDragStart={() => setSelectedIndex(slot.slotIndex)}
                    onDragStop={(_, position) =>
                      updateSlot(slot.slotIndex, {
                        x: position.x / stageSize.width,
                        y: position.y / stageSize.height,
                      })
                    }
                    onResizeStart={() => setSelectedIndex(slot.slotIndex)}
                    onResizeStop={(_, __, element, ___, position) =>
                      updateSlot(slot.slotIndex, {
                        x: position.x / stageSize.width,
                        y: position.y / stageSize.height,
                        width: element.offsetWidth / stageSize.width,
                        height: element.offsetHeight / stageSize.height,
                      })
                    }
                    position={{
                      x: slot.x * stageSize.width,
                      y: slot.y * stageSize.height,
                    }}
                    size={{
                      width: slot.width * stageSize.width,
                      height: slot.height * stageSize.height,
                    }}
                  >
                    <div
                      aria-label={`${slot.name} preview`}
                      className="frame-slot__inner"
                      onClick={() => setSelectedIndex(slot.slotIndex)}
                      onKeyDown={nudgeSelected}
                      role="button"
                      tabIndex={0}
                      style={{ backgroundImage: `url(${mockPhotoFor(slot.slotIndex)})` }}
                    >
                      <span className="frame-slot__label">
                        <FilmStrip aria-hidden="true" weight="bold" />
                        <span>SLOT_0{slot.slotIndex}</span>
                      </span>
                    </div>
                  </Rnd>
                );
              })}
              <img
                className="frame-stage__overlay"
                src={activeFrame?.mediaUrl ?? LOCAL_FIXTURES.defaultFrame}
                alt="Current transparent frame overlay"
                draggable="false"
              />
            </div>
          </div>
        </section>
        <aside className="slot-inspector" aria-label="Selected photo slot settings">
          <div className="slot-inspector__heading">
            <span>SELECTED SLOT</span>
            <h2>{selectedSlot?.name ?? 'Photo slot'}</h2>
          </div>
          <div className="slot-tabs" role="tablist" aria-label="Photo slots">
            {currentSlots.map((slot) => (
              <button
                aria-selected={selectedIndex === slot.slotIndex}
                className={selectedIndex === slot.slotIndex ? 'is-active' : ''}
                key={slot.slotIndex}
                onClick={() => setSelectedIndex(slot.slotIndex)}
                role="tab"
              >
                {slot.slotIndex}
              </button>
            ))}
          </div>
          {selectedSlot ? (
            <>
              <fieldset className="slot-inspector__group">
                <legend>POSITION &amp; SCALE (%)</legend>
                <div className="coordinate-grid">
                  {(['x', 'y', 'width', 'height'] as const).map((field) => (
                    <label key={field}>
                      <span>
                        {field === 'x'
                          ? 'X'
                          : field === 'y'
                            ? 'Y'
                            : field === 'width'
                              ? 'Width'
                              : 'Height'}{' '}
                        (%)
                      </span>
                      <input
                        aria-label={`${field} percent`}
                        max="100"
                        min="0"
                        onChange={(event) => updateSelectedPercent(field, event.target.value)}
                        step="0.1"
                        type="number"
                        value={percent(selectedSlot[field])}
                      />
                    </label>
                  ))}
                </div>
                <p>
                  Drag the slot on the canvas or enter coordinates. Arrow keys nudge selected slot.
                </p>
              </fieldset>
              <fieldset className="slot-inspector__group">
                <legend>
                  <Crop aria-hidden="true" weight="bold" /> CROP BEHAVIOR
                </legend>
                <label
                  className={`crop-option${selectedSlot.cropMode === 'crop-to-fill' ? ' is-selected' : ''}`}
                >
                  <input
                    checked={selectedSlot.cropMode === 'crop-to-fill'}
                    name={`crop-${selectedSlot.slotIndex}`}
                    onChange={() => setCropMode('crop-to-fill')}
                    type="radio"
                  />
                  <span>
                    <strong>Crop to fill</strong>
                    <small>Fill entire slot bounds and crop outer margins.</small>
                  </span>
                </label>
                <label
                  className={`crop-option${selectedSlot.cropMode === 'fit' ? ' is-selected' : ''}`}
                >
                  <input
                    checked={selectedSlot.cropMode === 'fit'}
                    name={`crop-${selectedSlot.slotIndex}`}
                    onChange={() => setCropMode('fit')}
                    type="radio"
                  />
                  <span>
                    <strong>Fit</strong>
                    <small>Preserve complete uncropped frame inside bounds.</small>
                  </span>
                </label>
              </fieldset>
              <Button
                icon={<ArrowCounterClockwise aria-hidden="true" weight="bold" />}
                onClick={resetSelected}
                variant="secondary"
                wide
              >
                Reset slot
              </Button>
            </>
          ) : null}
          {status ? (
            <p className="form-success" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
