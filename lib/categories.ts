export const CATEGORIES = [
  ["food", "Restaurants & meals"],
  ["coffee", "Coffee & snacks"],
  ["groceries", "Groceries"],
  ["alcohol", "Drinks & nightlife"],
  ["lodging", "Hotels & accommodation"],
  ["car_rental", "Car rental"],
  ["gas", "Fuel & EV charging"],
  ["taxi", "Taxis & rideshares"],
  ["public_transport", "Trains, buses & ferries"],
  ["flights", "Flights & baggage"],
  ["parking_tolls", "Parking & tolls"],
  ["transport", "Other transport"],
  ["activities", "Activities, tours & tickets"],
  ["shopping", "Shopping & souvenirs"],
  ["insurance", "Travel & rental insurance"],
  ["visas", "Visas & travel documents"],
  ["connectivity", "SIM, eSIM & Wi-Fi"],
  ["fees", "Taxes, fees & tips"],
  ["health", "Health & pharmacy"],
  ["laundry", "Laundry"],
  ["other", "Other"],
] as const;

const aliases: Record<string, string> = {
  rental_car: "car_rental",
  car_hire: "car_rental",
  car_rental_expenses: "car_rental",
  rental: "car_rental",
  hotel: "lodging",
  accommodation: "lodging",
  dining: "food",
  restaurant: "food",
  fuel: "gas",
  petrol: "gas",
  charging: "gas",
  transportation: "transport",
  travel: "transport",
  rideshare: "taxi",
  uber: "taxi",
  train: "public_transport",
  bus: "public_transport",
  ferry: "public_transport",
  flight: "flights",
  parking: "parking_tolls",
  tolls: "parking_tolls",
  activity: "activities",
  entertainment: "activities",
  tour: "activities",
  sim: "connectivity",
  esim: "connectivity",
  wifi: "connectivity",
  medical: "health",
  visa: "visas",
  tax: "fees",
  tip: "fees",
};
export function normalizeCategory(value: string | null | undefined): string {
  const key = (value || "other")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const category = aliases[key] || key;
  return CATEGORIES.some(([code]) => code === category) ? category : "other";
}
export function categoryLabel(value: string | null | undefined): string {
  return CATEGORIES.find(([code]) => code === normalizeCategory(value))![1];
}
