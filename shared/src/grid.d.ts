export declare const CELL_LAT: number;
export declare const ZONE_ROWS: number;

export type Cell = { row: number; col: number };
export type CellBounds = { south: number; north: number; west: number; east: number };
export type LatLng = { lat: number; lng: number };

export declare function cellAt(lat: number, lng: number): Cell;
export declare function cellBounds(cell: Cell): CellBounds;
export declare function cellCenter(cell: Cell): LatLng;
/** "row_col", used in URLs (e.g. /plot/1898319_44021). */
export declare function cellKey(cell: Cell): string;
export declare function parseCellKey(key: string): Cell | null;
export declare function neighbours(cell: Cell): Cell[];
export declare function cellsInBox(bounds: CellBounds, max?: number): Cell[];
export declare function distanceM(a: LatLng, b: LatLng): number;
