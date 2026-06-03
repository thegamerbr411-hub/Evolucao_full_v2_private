export const handleCoachAction = (action, navigation) => {
  switch (action) {
    case 'START_WORKOUT':
      navigation.navigate('TreinoHoje');
      break;
    case 'ADD_MEAL':
      navigation.navigate('Nutricao');
      break;
    case 'CONTINUE_WORKOUT':
      navigation.navigate('TreinoHoje');
      break;
    case 'QUICK_WORKOUT':
      navigation.navigate('TreinoHoje');
      break;
    default:
      break;
  }
};
