import { FilmStripIcon as FilmStrip } from '@phosphor-icons/react';

import { mockPhotoFor } from '../local-fixtures';

type PhotoSlotProps = {
  index: number;
  src?: string | undefined;
  label?: string;
  framed?: boolean;
};

export function PhotoSlot({ index, src, label = `Photo ${index}`, framed = true }: PhotoSlotProps) {
  const formattedIndex = String(index).padStart(2, '0');
  const photoSrc = src || mockPhotoFor(index);

  return (
    <figure className={`photo-slot${framed ? ' photo-slot--framed' : ''}`}>
      <div className="photo-slot__media">
        <img src={photoSrc} alt={label} draggable="false" />
        <span className="photo-slot__tag" aria-hidden="true">
          <FilmStrip weight="bold" />
          <span>FRAME {formattedIndex}</span>
        </span>
        <div className="photo-slot__crosshair photo-slot__crosshair--tl" aria-hidden="true">+</div>
        <div className="photo-slot__crosshair photo-slot__crosshair--br" aria-hidden="true">+</div>
      </div>
    </figure>
  );
}
