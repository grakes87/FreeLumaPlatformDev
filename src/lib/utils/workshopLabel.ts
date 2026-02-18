export function workshopLabel(mode: string | undefined): { singular: string; plural: string } {
  if (mode === 'bible') return { singular: 'Bible Study', plural: 'Bible Studies' };
  return { singular: 'Workshop', plural: 'Workshops' };
}
