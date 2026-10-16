import worldMap from './worldMap.json';

/** A time zone's city, its region, and where it is drawn (Antarctica's stations are not). */
export interface Place {
  city: string;
  region: string;
  x?: number;
  y?: number;
}

const PLACES: Record<string, Place> = worldMap.places;

/** What tzdata calls its regions, said for people. */
const REGIONS: Record<string, string> = {
  Africa: 'Africa',
  America: 'The Americas',
  Antarctica: 'Antarctica',
  Arctic: 'Arctic',
  Asia: 'Asia',
  Atlantic: 'Atlantic islands',
  Australia: 'Australia',
  Europe: 'Europe',
  Indian: 'Indian Ocean',
  Pacific: 'Pacific',
};

/** Where a time zone is: Europe/Paris is Paris, in Europe. */
export function placeOf(timeZone: string): Place {
  return PLACES[timeZone] ?? { city: timeZone, region: timeZone.split('/')[0] };
}

export function regionName(region: string): string {
  return REGIONS[region] ?? region;
}
