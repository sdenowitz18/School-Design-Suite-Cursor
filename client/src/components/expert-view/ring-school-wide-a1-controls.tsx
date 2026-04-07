import React from 'react';
import type { BucketDef, A1Value, TagSelection, ComponentType } from './expert-view-types';

function cloneSelections(sels: TagSelection[]): TagSelection[] {
  return JSON.parse(JSON.stringify(sels)) as TagSelection[];
}

interface RingSchoolWideA1ControlsProps {
  bucket: BucketDef;
  componentType: ComponentType;
  value: A1Value;
  onChange: (value: A1Value) => void;
  schoolWideValue?: A1Value;
}

/**
 * Ring only: "Same as school-wide" / "Different than school-wide" radio choice.
 * Center components render nothing — they use the normal tag picker directly.
 */
export function RingSchoolWideA1Controls({
  bucket,
  componentType,
  value,
  onChange,
  schoolWideValue,
}: RingSchoolWideA1ControlsProps) {
  if (componentType !== 'ring') return null;

  return (
    <div className="flex items-center gap-6 mb-4">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="radio"
          name={`${bucket.id}-ring-school-wide`}
          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
          checked={value.inheritFromSchool === true}
          onChange={() =>
            onChange({
              ...value,
              inheritFromSchool: true,
              selections: schoolWideValue?.selections?.length
                ? cloneSelections(schoolWideValue.selections)
                : [],
            })
          }
        />
        Same as school-wide
      </label>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="radio"
          name={`${bucket.id}-ring-school-wide`}
          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
          checked={value.inheritFromSchool !== true}
          onChange={() => onChange({ ...value, inheritFromSchool: false, selections: [] })}
        />
        Different than school-wide
      </label>
    </div>
  );
}
