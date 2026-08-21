import type { CSSProperties } from 'react';

import type { FrameSlot, FrameSummary } from '@grace-booth/shared';

import { PhotoSlot } from './PhotoSlot';

export type PhotostripFrame = Pick<FrameSummary, 'height' | 'mediaUrl' | 'slots' | 'width'>;

type PhotostripProps =
  | {
      captureUrls: readonly string[];
      frame: PhotostripFrame;
      label: string;
      variant: 'preview';
    }
  | {
      collageUrl: string;
      label: string;
      variant: 'collage';
    };

function slotStyle(slot: FrameSlot): CSSProperties {
  return {
    height: `${slot.height * 100}%`,
    left: `${slot.x * 100}%`,
    top: `${slot.y * 100}%`,
    width: `${slot.width * 100}%`,
  };
}

export function Photostrip(props: PhotostripProps) {
  if (props.variant === 'collage') {
    return (
      <div className="photostrip photostrip--collage">
        <img
          className="photostrip__collage"
          src={props.collageUrl}
          alt={props.label}
          draggable="false"
        />
      </div>
    );
  }

  const slots = [...props.frame.slots].sort((left, right) => left.slotIndex - right.slotIndex);

  return (
    <div
      className="photostrip photostrip--preview"
      style={{ aspectRatio: `${props.frame.width} / ${props.frame.height}` }}
      role="group"
      aria-label={props.label}
    >
      {slots.map((slot) => (
        <PhotoSlot
          className="photostrip__slot"
          cropMode={slot.cropMode}
          framed={false}
          index={slot.slotIndex}
          key={slot.slotIndex}
          label={`Captured photo ${slot.slotIndex}`}
          src={props.captureUrls[slot.slotIndex - 1]}
          style={slotStyle(slot)}
        />
      ))}
      <img
        className="photostrip__artwork"
        src={props.frame.mediaUrl}
        alt=""
        aria-hidden="true"
        draggable="false"
      />
    </div>
  );
}
