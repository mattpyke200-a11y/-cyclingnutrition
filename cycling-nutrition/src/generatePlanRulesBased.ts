// Rule-based nutrition plan generator (no API needed)

export interface UserInputs {
  rideType: 'casual' | 'endurance' | 'intense';
  rideDuration: number; // in minutes
  bodyWeight: number; // in kg
  goals: 'weight-loss' | 'maintenance' | 'performance';
}

export interface NutritionPlan {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  hydration: number;
  timing: string;
  foods: string[];
}

export function generateNutritionPlan(inputs: UserInputs): NutritionPlan {
  const { rideType, rideDuration, bodyWeight, goals } = inputs;

  // Base calories per minute by ride type
  const caloriesPerMinute = {
    casual: 5,
    endurance: 8,
    intense: 12,
  };

  // Calculate total energy expenditure
  const totalCalories = rideDuration * caloriesPerMinute[rideType];
  
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
    carbPercent = 0.6;
    proteinPercent = 0.15;
    fatPercent = 0.25;
  } else if (rideType === 'intense') {
    carbPercent = 0.55;
    proteinPercent = 0.25;
    fatPercent = 0.2;
  }

  const carbs = (adjustedCalories * carbPercent) / 4; // 4 cal/g
  const protein = (adjustedCalories * proteinPercent) / 4;
  const fat = (adjustedCalories * fatPercent) / 9; // 9 cal/g

  // Hydration: 500ml per 30 mins of exercise
  const hydration = (rideDuration / 30) * 500;

  // Meal timing recommendations
  let timing = '';
  if (rideDuration < 60) {
    timing = 'Light snack 1-2 hours before. No fueling needed during ride.';
  } else if (rideDuration < 120) {
    timing = 'Meal 2-3 hours before. Small snack (20-30g carbs) every 45 mins during ride.';
  } else {
    timing = 'Carb-loading 3 hours before. 30-60g carbs every 45 mins. Recovery meal within 30 mins.';
  }

  // Food recommendations based on macros
  const foods = recommendFoods(carbs, protein, fat, rideType);

  return {
    calories: Math.round(adjustedCalories),
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    hydration: Math.round(hydration),
    timing,
    foods,
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
  if (carbs > 150) {
    foods.push('Oatmeal with honey (200g oats)');
    foods.push('Pasta with tomato sauce (300g cooked)');
    foods.push('Energy bars (3-4 bars)');
  } else if (carbs > 100) {
    foods.push('Banana with peanut butter');
    foods.push('Rice cakes with jam');
    foods.push('Trail mix (50g)');
  } else {
    foods.push('Apple with cheese');
    foods.push('Granola bar');
  }

  // Protein sources
  if (protein > 30) {
    foods.push('Chicken breast (150g)');
    foods.push('Greek yogurt (200g)');
    foods.push('Eggs (3-4 eggs)');
  } else if (protein > 20) {
    foods.push('Cottage cheese (100g)');
    foods.push('Protein shake');
  }

  // Fat sources
  if (fat > 20) {
    foods.push('Avocado (1 whole)');
    foods.push('Olive oil (2 tbsp)');
    foods.push('Nuts (30g handful)');
  }

  // Add electrolyte reminder
  foods.push(`Electrolyte drink (${Math.round(carbs / 10)}g carbs)`);

  return foods;
}