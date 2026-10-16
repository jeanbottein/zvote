import { formatCount } from '../utils/formatCount';
import { placeOf, regionName } from './geography';
import './statistics.css';

export interface Column<K extends string> {
  key: K;
  label: string;
}

type Row<K extends string> = Record<K, number>;

interface PlacesTableProps<K extends string> {
  regions: (Row<K> & { region: string })[];
  places: (Row<K> & { timeZone: string })[];
  columns: Column<K>[];
  /** The column both regions and their cities are ordered by, most first. */
  orderBy: K;
  onShow(timeZone: string): void;
}

/** Regions, each followed by its cities: the map's numbers, for reading rather than pointing. */
export default function PlacesTable<K extends string>(
  { regions, places, columns, orderBy, onShow }: PlacesTableProps<K>,
) {
  const most = (a: Row<K>, b: Row<K>) => b[orderBy] - a[orderBy];
  return (
    <table className="places-table">
      <thead>
        <tr>
          <th scope="col">Region and city</th>
          {columns.map((column) => (
            <th key={column.key} scope="col" aria-sort={column.key === orderBy ? 'descending' : undefined}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      {[...regions].sort(most).map((region) => (
        <tbody key={region.region}>
          <tr className="places-table-region">
            <th scope="row">{regionName(region.region)}</th>
            {columns.map((column) => <td key={column.key}>{formatCount(region[column.key])}</td>)}
          </tr>
          {places.filter((place) => placeOf(place.timeZone).region === region.region).sort(most).map((place) => (
            <tr key={place.timeZone}>
              <th scope="row">
                <button type="button" className="button link" onClick={() => onShow(place.timeZone)}>
                  {placeOf(place.timeZone).city}
                </button>
              </th>
              {columns.map((column) => <td key={column.key}>{formatCount(place[column.key])}</td>)}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
