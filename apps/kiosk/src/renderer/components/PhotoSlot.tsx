import { mockPhotoFor } from '../local-fixtures';

type PhotoSlotProps = {
  index: number;
  src?: string | undefined;
  label?: string;
  framed?: boolean;
};

export function PhotoSlot({ index, src, label = `Photo ${index}`, framed = true }: PhotoSlotProps) {
  const photoSrc = src || mockPhotoFor(index);

  return (
    <figure className={`photo-slot${framed ? ' photo-slot--framed' : ''}`}>
      <div className="photo-slot__media">
        <img src={photoSrc} alt={label} draggable="false" />
      </div>
    </figure>
  );
}
