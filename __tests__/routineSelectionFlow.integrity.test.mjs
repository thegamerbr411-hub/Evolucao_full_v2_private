import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTINES_FILE = join(process.cwd(), 'src', 'screens', 'RoutinesScreen.js');
const WORKOUT_FILE = join(process.cwd(), 'src', 'screens', 'WorkoutScreen.js');
const CONTEXT_FILE = join(process.cwd(), 'src', 'context', 'AppContext.js');

test('routine start should navigate with selected workout id', () => {
  const source = readFileSync(ROUTINES_FILE, 'utf8');

  assert.match(
    source,
    /navigation\.navigate\('Workout',\s*\{\s*workoutId:\s*routine\.id\s*\}\)/,
    'RoutinesScreen must pass the selected routine id when starting workout'
  );

  assert.equal(source.includes('routineExercises:'), false, 'RoutinesScreen should not pass routineExercises fallback payload');
});

test('workout screen should load selected routine by workoutId', () => {
  const source = readFileSync(WORKOUT_FILE, 'utf8');

  assert.match(source, /route\?\.params\?\.workoutId/, 'WorkoutScreen must read route params workoutId');
  assert.match(source, /getUserRoutineById\(selectedWorkoutId\)/, 'WorkoutScreen must resolve routine by selected id');
  assert.equal(source.includes('route.params?.routineExercises'), false, 'WorkoutScreen should not rely on routineExercises fallback');
});

test('user routines should keep unique ids in context', () => {
  const source = readFileSync(CONTEXT_FILE, 'utf8');

  assert.match(source, /function\s+buildRoutineId\(/, 'AppContext must provide routine id generator');
  assert.match(source, /function\s+sanitizeUserRoutines\(/, 'AppContext must sanitize stored routines and fix duplicate ids');
  assert.match(source, /const\s+getUserRoutineById\s*=\s*useCallback\(/, 'AppContext must expose routine lookup by id');
});
