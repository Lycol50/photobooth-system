import {
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  CropIcon as Crop,
  FilePngIcon as FilePng,
  FloppyDiskIcon as FloppyDisk,
  FilmStripIcon as FilmStrip,
  RowsIcon as Rows,
  SidebarSimpleIcon as SidebarSimple,
  SquaresFourIcon as SquaresFour,
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
  busy?: boolean;
  error?: string | null;
  frame: FrameSummary;
  onChooseFrame: () => void;
  onSave: (slots: FrameLayout) => void;
  status?: string | null;
};

type StageSize = {
  height: number;
  width: number;
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
  onChooseFrame,
  onSave,
  status,
}: FrameEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ width: 540, height: 720 });
  const [slots, setSlots] = useState<FrameLayout>(() => frame.slots.map((slot) => ({ ...slot })));
  const [selectedIndex, setSelectedIndex] = useState(1);

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
  }, [frame.height, frame.width]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.slotIndex === selectedIndex) ?? slots[0],
    [selectedIndex, slots],
  );

  const updateSlot = (slotIndex: number, update: Partial<FrameSlot>) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.slotIndex === slotIndex ? constrainSlot({ ...slot, ...update }) : slot,
      ),
    );
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
    const persisted = frame.slots.find((slot) => slot.slotIndex === selectedIndex);
    if (persisted) {
      updateSlot(selectedIndex, persisted);
    }
  };

  const applyPreset = (preset: 'grid-2x2' | 'strip-4' | 'hero-trio') => {
    setSlots((current) => {
      return current.map((slot) => {
        const slotIdx = slot.slotIndex;
        if (preset === 'grid-2x2') {
          const x = slotIdx === 1 || slotIdx === 3 ? 0.06 : 0.53;
          const y = slotIdx <= 2 ? 0.05 : 0.51;
          return constrainSlot({ ...slot, x, y, width: 0.41, height: 0.42, cropMode: 'crop-to-fill' });
        }
        if (preset === 'strip-4') {
          const yPositions = [0.04, 0.27, 0.50, 0.73];
          const y = yPositions[slotIdx - 1] ?? 0.04;
          return constrainSlot({ ...slot, x: 0.12, y, width: 0.76, height: 0.20, cropMode: 'crop-to-fill' });
        }
        if (preset === 'hero-trio') {
          if (slotIdx === 1) {
            return constrainSlot({ ...slot, x: 0.06, y: 0.05, width: 0.56, height: 0.88, cropMode: 'crop-to-fill' });
          }
          const yPositions = [0.05, 0.355, 0.66];
          const y = yPositions[slotIdx - 2] ?? 0.05;
          return constrainSlot({ ...slot, x: 0.66, y, width: 0.28, height: 0.27, cropMode: 'crop-to-fill' });
        }
        return slot;
      });
    });
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

  return (
    <div className="frame-editor" data-testid="frame-editor">
      <header className="admin-page-header">
        <div>
          <h1 data-screen-heading tabIndex={-1}>
            FRAME EDITOR
          </h1>
          <p>
            Configure how four guest photos map onto the frame canvas. All positions stay proportional to the frame.
          </p>
        </div>
        <div className="admin-page-header__actions">
          <Button
            icon={<FilePng aria-hidden="true" weight="bold" />}
            onClick={onChooseFrame}
            variant="secondary"
          >
            Replace frame
          </Button>
          <Button
            icon={<FloppyDisk aria-hidden="true" weight="bold" />}
            loading={busy}
            onClick={() => onSave(slots)}
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
                aspectRatio: `${frame.width} / ${frame.height}`,
              }}
            >
              {slots.map((slot) => {
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
                    position={{ x: slot.x * stageSize.width, y: slot.y * stageSize.height }}
                    size={{
                      width: slot.width * stageSize.width,
                      height: slot.height * stageSize.height,
                    }}
                  >
                    <div
                      className="frame-slot__content"
                      onClick={() => setSelectedIndex(slot.slotIndex)}
                      onKeyDown={nudgeSelected}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slot.name}. Use arrow keys to move. Use the inspector to resize.`}
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
                src={frame.mediaUrl || LOCAL_FIXTURES.defaultFrame}
                alt="Current transparent frame overlay"
                draggable="false"
              />
            </div>
          </div>
        </section>
        <aside className="slot-inspector" aria-label="Selected photo slot settings">
          <fieldset className="slot-inspector__group preset-group">
            <legend>LAYOUT PRESETS</legend>
            <div className="preset-buttons">
              <button
                className="preset-btn"
                onClick={() => applyPreset('grid-2x2')}
                title="2x2 Balanced Grid"
                type="button"
              >
                <SquaresFour aria-hidden="true" size={16} weight="bold" />
                <span>2×2 Grid</span>
              </button>
              <button
                className="preset-btn"
                onClick={() => applyPreset('strip-4')}
                title="Classic Vertical 4-Strip"
                type="button"
              >
                <Rows aria-hidden="true" size={16} weight="bold" />
                <span>4-Strip</span>
              </button>
              <button
                className="preset-btn"
                onClick={() => applyPreset('hero-trio')}
                title="Hero Portrait with 3 Thumbnails"
                type="button"
              >
                <SidebarSimple aria-hidden="true" size={16} weight="bold" />
                <span>Hero+3</span>
              </button>
            </div>
          </fieldset>
          <div className="slot-inspector__heading">
            <span>SELECTED SLOT</span>
            <h2>{selectedSlot?.name ?? 'Photo slot'}</h2>
          </div>
          <div className="slot-tabs" role="tablist" aria-label="Photo slots">
            {slots.map((slot) => (
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
                <p>Drag the slot on the canvas or enter coordinates. Arrow keys nudge selected slot.</p>
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
