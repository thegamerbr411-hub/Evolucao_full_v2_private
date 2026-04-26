import * as Notifications from 'expo-notifications';

export async function scheduleStreakPush(streak, lastWorkout) {
  const today = new Date().toISOString().slice(0, 10);
  if (lastWorkout === today) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Continue sua streak!',
      body: `Você está há ${streak} dias seguidos. Bora treinar hoje?`,
    },
    trigger: { hour: 19, minute: 0, repeats: true },
  });
}
