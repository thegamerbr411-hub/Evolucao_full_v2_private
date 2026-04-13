import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveWorkout = async (workout) => {
  const payload = {
    version: 1,
    name: workout?.name || 'Treino',
    exercises: Array.isArray(workout?.exercises) ? workout.exercises : [],
  };

  await AsyncStorage.setItem('workout', JSON.stringify(payload));
};

export const loadWorkout = async () => {
  const data = await AsyncStorage.getItem('workout');
  if (!data) {
    return null;
  }

  const parsed = JSON.parse(data);
  if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'version')) {
    return parsed;
  }

  return {
    version: 1,
    name: parsed?.name || 'Treino',
    exercises: Array.isArray(parsed?.exercises) ? parsed.exercises : [],
  };
};
