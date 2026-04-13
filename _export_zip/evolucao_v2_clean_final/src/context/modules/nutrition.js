export function sumNutritionTotals(items = []) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fats: acc.fats + Number(item.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}
