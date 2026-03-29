import { useState } from 'react';
import { generateNutritionPlan, UserInputs, NutritionPlan } from './generatePlanRulesBased';

export function GeneratePlan() {
  const [inputs, setInputs] = useState<UserInputs>({
    rideType: 'casual',
    rideDuration: 60,
    bodyWeight: 75,
    goals: 'maintenance',
  });

  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      // Simulate small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      const newPlan = generateNutritionPlan(inputs);
      setPlan(newPlan);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Generate Cycling Nutrition Plan</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Details</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ride Type</label>
            <select
              value={inputs.rideType}
              onChange={(e) =>
                setInputs({ ...inputs, rideType: e.target.value as any })
              }
              className="w-full p-2 border rounded"
            >
              <option value="casual">Casual (easy pace)</option>
              <option value="endurance">Endurance (long ride)</option>
              <option value="intense">Intense (hard effort)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Ride Duration (minutes)
            </label>
            <input
              type="number"
              value={inputs.rideDuration}
              onChange={(e) =>
                setInputs({ ...inputs, rideDuration: parseInt(e.target.value) })
              }
              className="w-full p-2 border rounded"
              min="10"
              max="300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Body Weight (kg)
            </label>
            <input
              type="number"
              value={inputs.bodyWeight}
              onChange={(e) =>
                setInputs({ ...inputs, bodyWeight: parseFloat(e.target.value) })
              }
              className="w-full p-2 border rounded"
              min="40"
              max="150"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Goals</label>
            <select
              value={inputs.goals}
              onChange={(e) =>
                setInputs({ ...inputs, goals: e.target.value as any })
              }
              className="w-full p-2 border rounded"
            >
              <option value="weight-loss">Weight Loss (10-15% deficit)</option>
              <option value="maintenance">Maintenance</option>
              <option value="performance">Performance (10-15% surplus)</option>
            </select>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={loading}
            className="w-full bg-blue-600 text-white p-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Plan'}
          </button>
        </div>
      </div>

      {plan && (
        <div className="bg-green-50 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-green-700">Your Nutrition Plan</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded border-l-4 border-green-500">
              <p className="text-sm text-gray-600">Total Calories</p>
              <p className="text-2xl font-bold">{plan.calories} kcal</p>
            </div>
            <div className="bg-white p-4 rounded border-l-4 border-blue-500">
              <p className="text-sm text-gray-600">Hydration</p>
              <p className="text-2xl font-bold">{plan.hydration} ml</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded mb-6 border-l-4 border-yellow-500">
            <h3 className="font-semibold mb-2">Macronutrients</h3>
            <ul className="space-y-2">
              <li>🥗 <strong>Carbs:</strong> {plan.carbs}g (~40% energy)</li>
              <li>🍗 <strong>Protein:</strong> {plan.protein}g (~20% energy)</li>
              <li>🥑 <strong>Fat:</strong> {plan.fat}g (~30% energy)</li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded mb-6 border-l-4 border-purple-500">
            <h3 className="font-semibold mb-2">Timing</h3>
            <p className="text-gray-700">{plan.timing}</p>
          </div>

          <div className="bg-white p-4 rounded border-l-4 border-orange-500">
            <h3 className="font-semibold mb-2">Recommended Foods</h3>
            <ul className="space-y-1">
              {plan.foods.map((food, i) => (
                <li key={i} className="text-gray-700">✓ {food}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}