import type { BucketDef, TagDef } from './expert-view-types';

/** Flatten all A-1 tags for lookup (including discipline-grouped buckets). */
export function allTagsFromBucket(bucket: BucketDef): TagDef[] {
  if (bucket.disciplineGroups?.length) {
    return bucket.disciplineGroups.flatMap((g) => g.tags);
  }
  return bucket.tags ?? [];
}
