/** Major place labels for Central Russia / Smolensk (offline smart labels). */
export interface PlaceLabel {
  name: string;
  lat: number;
  lng: number;
  rank: 1 | 2 | 3;
}

export const CENTRAL_RU_PLACES: PlaceLabel[] = [
  { name: "Смоленск", lat: 54.782, lng: 32.045, rank: 1 },
  { name: "Вязьма", lat: 55.21, lng: 34.295, rank: 2 },
  { name: "Рославль", lat: 53.949, lng: 32.864, rank: 2 },
  { name: "Ярцево", lat: 55.066, lng: 32.69, rank: 2 },
  { name: "Сафоново", lat: 55.09, lng: 33.25, rank: 2 },
  { name: "Гагарин", lat: 55.553, lng: 35.0, rank: 2 },
  { name: "Десногорск", lat: 54.152, lng: 33.29, rank: 2 },
  { name: "Дорогобуж", lat: 54.92, lng: 33.307, rank: 3 },
  { name: "Ельня", lat: 54.578, lng: 33.176, rank: 3 },
  { name: "Рудня", lat: 54.948, lng: 31.1, rank: 3 },
  { name: "Починок", lat: 54.407, lng: 32.445, rank: 3 },
  { name: "Велиж", lat: 55.606, lng: 31.197, rank: 3 },
  { name: "Сычёвка", lat: 55.832, lng: 34.28, rank: 3 },
  { name: "Москва", lat: 55.7558, lng: 37.6173, rank: 1 },
  { name: "Калуга", lat: 54.514, lng: 36.271, rank: 1 },
  { name: "Тверь", lat: 56.8587, lng: 35.9176, rank: 1 },
  { name: "Брянск", lat: 53.2521, lng: 34.3717, rank: 1 },
  { name: "Орёл", lat: 52.9703, lng: 36.0634, rank: 2 },
  { name: "Витебск", lat: 55.1904, lng: 30.2049, rank: 2 },
  { name: "Могилёв", lat: 53.9168, lng: 30.3449, rank: 2 },
];

export function placesVisibleAtZoom(z: number): PlaceLabel[] {
  if (z >= 10) return CENTRAL_RU_PLACES;
  if (z >= 8) return CENTRAL_RU_PLACES.filter((p) => p.rank <= 2);
  return CENTRAL_RU_PLACES.filter((p) => p.rank === 1);
}
