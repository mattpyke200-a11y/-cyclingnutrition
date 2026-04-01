// Rule-based nutrition plan generator (no API needed)

export interface UserInputs {
  rideType: 'casual' | 'endurance' | 'intense';
  rideDuration: number; // in minutes
  bodyWeight: number; // in kg
  goals: 'weight-loss' | 'maintenance' | 'performance';
}

export interface ProductRecommendation {
  name: string;
  bottleSize: string;
  perHour: number;
  timing: string;
  notes: string;
}

export interface NutritionPlan {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  hydration: number;
  timing: string;
  foods: string[];
  products: ProductRecommendation[];
}

export function generateNutritionPlan(inputs: UserInputs): NutritionPlan {
  const { rideType, rideDuration, bodyWeight, goals } = inputs;

  // More realistic base calories per kg per hour by ride type
  const caloriesPerKgPerHour = {
    casual: 4,      // 4 kcal/kg/hour easy pace
    endurance: 6,   // 6 kcal/kg/hour steady endurance
    intense: 10,    // 10 kcal/kg/hour hard effort
  };

  const durationHours = rideDuration / 60;
  const totalCalories = durationHours * bodyWeight * caloriesPerKgPerHour[rideType];
  
  // Adjust for goals
  let adjustedCalories = totalCalories;
  if (goals === 'weight-loss') {
    adjustedCalories = totalCalories * 0.85; // 85% for deficit
  } else if (goals === 'performance') {
    adjustedCalories = totalCalories * 1.15; // 115% for surplus
  }

  // Macronutrient distribution
  let carbPercent = 0.5;
  let proteinPercent = 0.2;
  let fatPercent = 0.3;

  // Adjust ratios based on ride type
  if (rideType === 'endurance') {
    carbPercent = 0.55;
    proteinPercent = 0.15;
    fatPercent = 0.3;
  } else if (rideType === 'intense') {
    carbPercent = 0.6;
    proteinPercent = 0.2;
    fatPercent = 0.2;
  }

  const carbs = (adjustedCalories * carbPercent) / 4; // 4 cal/g
  const protein = (adjustedCalories * proteinPercent) / 4;
  const fat = (adjustedCalories * fatPercent) / 9; // 9 cal/g

  // Hydration: 400-800ml per hour based on intensity and body weight
  // More realistic: 6-8 ml/kg/hour
  const hydrationPerHour = bodyWeight * 7; // 7 ml/kg/hour average
  const hydration = durationHours * hydrationPerHour;

  // Meal timing recommendations
  let timing = '';
  if (rideDuration < 60) {
    timing = 'Light snack 1-2 hours before. No fueling needed during ride.';
  } else if (rideDuration < 120) {
    timing = 'Meal 2-3 hours before. Small snack (20-30g carbs) every 60-90 mins during ride.';
  } else {
    timing = 'Carb-loading 3 hours before. 30-60g carbs per hour during ride. Recovery meal within 30 mins.';
  }

  // Food recommendations based on macros
  const foods = recommendFoods(carbs, protein, fat, rideType);

  // Product recommendations
  const products = recommendProducts(rideDuration, rideType, carbs, bodyWeight);

  return {
    calories: Math.round(adjustedCalories),
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    hydration: Math.round(hydration),
    timing,
    foods,
    products,
  };
}

function recommendFoods(
  carbs: number,
  protein: number,
  fat: number,
  rideType: string
): string[] {
  const foods: string[] = [];

  // Carb sources
  if (carbs > 200) {
    foods.push('Oatmeal with banana and honey (250g)');
    foods.push('Pasta with olive oil and tomato (350g cooked)');
    foods.push('Energy gels (4-5 gels)');
  } else if (carbs > 100) {
    foods.push('Toast with jam and almond butter (2 slices)');
    foods.push('Rice cakes with honey (4-5 cakes)');
    foods.push('Dried fruit mix (80g)');
  } else {
    foods.push('Banana with small handful of nuts');
    foods.push('Granola bar (40g)');
  }

  // Protein sources
  if (protein > 40) {
    foods.push('Chicken breast (180g)');
    foods.push('Greek yogurt (250g)');
    foods.push('Eggs (4 eggs)');
  } else if (protein > 25) {
    foods.push('Cottage cheese (150g)');
    foods.push('Protein shake (30g protein powder)');
  } else {
    foods.push('Yogurt (150g)');
  }

  // Fat sources
  if (fat > 25) {
    foods.push('Avocado (1 whole)');
    foods.push('Olive oil (1.5 tbsp)');
    foods.push('Mixed nuts (40g)');
  }

  return foods;
}

function recommendProducts(
  rideDuration: number,
  rideType: string,
  carbs: number,
  bodyWeight: number
): ProductRecommendation[] {
  const products: ProductRecommendation[] = [];
  const durationHours = rideDuration / 60;

  // Pre-Fuel (ESN Pre-Fuel KOM) - 500ml bottle
  if (rideDuration > 45) {
    products.push({
      name: 'ESN Pre-Fuel KOM',
      bottleSize: '500ml',
      perHour: 0,
      timing: '1-2 hours before ride',
      notes: `Take 1 bottle (500ml) pre-ride. Non-caffeinated option for morning rides.`,
    });
  }

  // C30 (Neversecond C30) - 500ml bottle with 30g carbs
  // Realistic carb intake: 30-60g per hour for endurance, 60-90g for intense
  if (rideDuration >= 60) {
    let carbsPerHour = 0;
    
    if (rideType === 'casual') {
      carbsPerHour = 20; // 20g carbs per hour for casual rides
    } else if (rideType === 'endurance') {
      carbsPerHour = 40; // 40g carbs per hour for endurance
    } else if (rideType === 'intense') {
      carbsPerHour = 60; // 60g carbs per hour for intense efforts
    }

    // C30 provides 30g carbs per 500ml bottle
    // So bottles per hour = carbsPerHour / 30
    const c30PerHour = carbsPerHour / 30;
    const totalC30Bottles = durationHours * c30PerHour;
    
    products.push({
      name: 'Neversecond C30',
      bottleSize: '500ml (30g carbs)',
      perHour: Math.round(c30PerHour * 10) / 10,
      timing: 'Every 30-45 minutes during ride',
      notes: `Total: ${Math.round(totalC30Bottles * 10) / 10} bottles for ${Math.round(rideDuration)} min ride. Consume ${Math.round(c30PerHour * 500)}ml per hour delivering ${carbsPerHour}g carbs.`,
    });
  }

  // Re-Fuel NICA (Recovery) - 500ml bottle
  products.push({
    name: 'ESN Re-Fuel NICA',
    bottleSize: '500ml (recovery)',
    perHour: 0,
    timing: 'Within 30 minutes after ride',
    notes: `Take 1 bottle (500ml) immediately post-ride for optimal recovery. Ideal 3:1 carb-to-protein ratio.`,
  });

  // Hydration recommendation
  if (rideDuration > 60) {
    const hydroPerHour = (bodyWeight * 7) / 500; // Convert ml to 500ml bottles
    products.push({
      name: 'Water + Electrolytes',
      bottleSize: '500ml',
      perHour: Math.round(hydroPerHour * 10) / 10,
      timing: 'Spread throughout ride',
      notes: `Consume ${Math.round(bodyWeight * 7)}ml per hour (${Math.round(hydroPerHour * 10) / 10} bottles) with electrolytes to replace sweat losses.`,
    });
  }

  return products;
}