export const BUDGET_CATEGORIES = [
  { id: "foodDrink", label: "Food & Drink",  emoji: "🍜", color: "#e8821e" },
  { id: "shopping",  label: "Shopping",      emoji: "🛍️", color: "#d64f93" },
  { id: "transport", label: "Transportation", emoji: "🚆", color: "#1f6fd6" }
];
const BUDGET_CATEGORY_ALIASES = {
  food: "foodDrink",
  groceries: "foodDrink",
  dining: "foodDrink",
  clothing: "shopping",
  souvenirs: "shopping",
  gifts: "shopping",
  transportation: "transport",
  transit: "transport",
  train: "transport",
  taxi: "transport"
};
export const TRANSPORT_MODES = [
  { id: "train",     label: "Train" },
  { id: "taxi",      label: "Taxi" },
  { id: "rentalCar", label: "Rental Car" },
  { id: "bus",       label: "Bus" },
  { id: "walk",      label: "Walk" },
  { id: "ferry",     label: "Ferry" },
  { id: "flight",    label: "Flight" },
  { id: "other",     label: "Other" }
];
export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch",     label: "Lunch" },
  { id: "dinner",    label: "Dinner" },
  { id: "snack",     label: "Snack" }
];
export const normalizeBudgetCategoryId = id => {
  if (BUDGET_CATEGORIES.some(c => c.id === id)) return id;
  return BUDGET_CATEGORY_ALIASES[id] || "other";
};
export const categoryById = id =>
  BUDGET_CATEGORIES.find(c => c.id === normalizeBudgetCategoryId(id)) ||
  { id: "other", label: "Other", emoji: "•", color: "#8a8a8e" };
