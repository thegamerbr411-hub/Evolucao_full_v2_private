import { useWorkoutDomain } from '../context/AppContext';

export function useWorkout() {
  return useWorkoutDomain();
}
