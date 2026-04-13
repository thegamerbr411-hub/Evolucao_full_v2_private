export const handleCoachAction = (action, navigation) => {
  switch (action) {
    case 'START_WORKOUT':
      navigation.navigate('Workout');
      break;
    case 'ADD_MEAL':
      navigation.navigate('Nutrition');
      break;
    case 'CONTINUE_WORKOUT':
      navigation.navigate('Workout');
      break;
    case 'QUICK_WORKOUT':
      navigation.navigate('Workout');
      break;
    default:
      break;
  }
};
