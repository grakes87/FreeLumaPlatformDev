export const MERGE_FIELDS = [
  'PastorName', 'ChurchName', 'City', 'State',
  'Denomination', 'ContactName',
] as const;

export const ASSET_FIELDS = [
  'LogoUrl', 'HeroImageUrl', 'VideoUrl', 'VideoThumbnailUrl',
] as const;

export type MergeField = typeof MERGE_FIELDS[number];

interface ChurchData {
  id?: number;
  name: string;
  pastor_name?: string | null;
  city?: string | null;
  state?: string | null;
  denomination?: string | null;
  contact_email?: string | null;
}

export function renderTemplate(
  template: string,
  church: ChurchData,
  assets?: Record<string, string> | null,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://freeluma.app';

  const fieldMap: Record<string, string> = {
    PastorName: church.pastor_name || 'Pastor',
    ChurchName: church.name,
    City: church.city || '',
    State: church.state || '',
    Denomination: church.denomination || 'your church',
    ContactName: church.pastor_name || church.contact_email?.split('@')[0] || 'Friend',
    SampleRequestUrl: church.id ? `${appUrl}/sample-request?cid=${church.id}` : `${appUrl}/sample-request`,
  };

  // Include asset URLs in the replacement map
  if (assets) {
    for (const key of ASSET_FIELDS) {
      if (assets[key]) {
        fieldMap[key] = assets[key];
      }
    }
  }

  return template.replace(
    /\{(\w+)\}/g,
    (match, field) => fieldMap[field] ?? match
  );
}

export function renderSubject(subject: string, church: ChurchData): string {
  return renderTemplate(subject, church);
}
