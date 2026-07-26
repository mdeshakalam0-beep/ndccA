export interface ClassBasedContent {
  classId?: string;
}

/**
 * Filters a collection of class-based content to show only items matching
 * the student's classId, or items marked as visible to "All Classes" ('all').
 */
export function filterContentByClass<T extends ClassBasedContent>(
  items: T[],
  studentClassId: string | null | undefined
): T[] {
  if (!studentClassId) return items;
  return items.filter(
    (item) => item.classId === studentClassId || item.classId === 'all'
  );
}
