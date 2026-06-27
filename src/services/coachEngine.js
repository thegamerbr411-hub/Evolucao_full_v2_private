export const generateCoach = ({ workout, nutrition, history, time }) => {
  if (!workout?.exercises?.length) {
    return {
      message: 'Você ainda não treinou. Comece agora.',
      action: 'START_WORKOUT',
      priority: 10,
    };
  }

  if ((workout?.exercises?.length || 0) < 3) {
    return {
      message: 'Treino fraco. Adiciona mais exercicio.',
      action: 'CONTINUE_WORKOUT',
      priority: 9,
    };
  }

  if (Number(nutrition?.protein || 0) < 80) {
    return {
      message: 'Proteina baixa. Come algo agora.',
      action: 'ADD_MEAL',
      priority: 8,
    };
  }

  if (Number(time || 0) > 22 && !workout?.done) {
    return {
      message: 'Ta tarde. Faz pelo menos um treino curto.',
      action: 'QUICK_WORKOUT',
      priority: 7,
    };
  }

  if (Number(history?.streak || 0) >= 5) {
    return {
      message: 'Hoje e dia de subir carga.',
      action: 'PROGRESS',
      priority: 6,
    };
  }

  return {
    message: 'Faz mais 1 exercicio agora.',
    action: 'CONTINUE_WORKOUT',
    priority: 1,
  };
};
