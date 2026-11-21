export interface Line { name: string; values: (string | number | null)[] }
export interface Chart { title: string; caption: string; unit: string; labels: string[]; series: Line[]; type: 'line' | 'bar'; keys: string[] }
