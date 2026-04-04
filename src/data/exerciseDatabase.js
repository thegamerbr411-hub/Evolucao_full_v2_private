const exerciseDatabase = {
  peito: [
    { id: '0001', nome: 'Supino Reto com Barra', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0002', '0003'], equipamento: 'Barra', dicas: ['Escapulas aduzidas', 'Barra no meio do peito', 'Pes firmes'], dificuldade: 'medio' },
    { id: '0002', nome: 'Supino Inclinado com Halteres', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0001', '0003'], equipamento: 'Halteres', dicas: ['Angulo de 30-45 graus', 'Controlar a descida', 'Foco no peitoral superior'], dificuldade: 'medio' },
    { id: '0003', nome: 'Crucifixo Maquina', grupo: 'peito', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0002'], equipamento: 'Maquina', dicas: ['Cotovelos levemente flexionados', 'Alongar bem o peito', 'Nao bater os pesos'], dificuldade: 'facil' },
    { id: '0004', nome: 'Supino Declinado com Barra', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0001'], equipamento: 'Barra', dicas: ['Ponte leve e estavel', 'Barra na linha inferior do peito', 'Controle no retorno'], dificuldade: 'medio' },
    { id: '0005', nome: 'Crossover no Cabo', grupo: 'peito', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0003'], equipamento: 'Cabo', dicas: ['Passo a frente', 'Fechar com controle', 'Manter peito aberto'], dificuldade: 'facil' },
    { id: '0006', nome: 'Flexao de Bracos', grupo: 'peito', tipo: 'composto', nivel: 'iniciante', substitutos: ['0001', '0002'], equipamento: 'Peso corporal', dicas: ['Linha neutra do corpo', 'Descer com controle', 'Subir sem perder tronco'], dificuldade: 'facil' },
    { id: '0007', nome: 'Pullover com Halter', grupo: 'peito', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0005'], equipamento: 'Halteres', dicas: ['Bracos semi-flexionados', 'Alongar sem perder lombar', 'Subir focando peitoral'], dificuldade: 'medio' }
  ],
  costas: [
    { id: '0008', nome: 'Puxada Frente no Pulldown', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0009'], equipamento: 'Cabo', dicas: ['Puxar com o cotovelo', 'Peito estufado', 'Nao balancar tronco'], dificuldade: 'facil' },
    { id: '0009', nome: 'Remada Curvada com Barra', grupo: 'costas', tipo: 'composto', nivel: 'avancado', substitutos: ['0010'], equipamento: 'Barra', dicas: ['Coluna neutra', 'Trazer barra ao umbigo', 'Joelhos semi-flexionados'], dificuldade: 'dificil' },
    { id: '0010', nome: 'Remada Unilateral com Halter', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0009'], equipamento: 'Halteres', dicas: ['Apoio estavel', 'Puxar para o quadril', 'Nao girar tronco'], dificuldade: 'facil' },
    { id: '0011', nome: 'Remada Baixa no Cabo', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0008', '0010'], equipamento: 'Cabo', dicas: ['Peito aberto', 'Cotovelos junto ao tronco', 'Retorno controlado'], dificuldade: 'facil' },
    { id: '0012', nome: 'Barra Fixa Pronada', grupo: 'costas', tipo: 'composto', nivel: 'avancado', substitutos: ['0008'], equipamento: 'Peso corporal', dicas: ['Corpo em bloco', 'Subir com escapulas', 'Descer completo'], dificuldade: 'dificil' },
    { id: '0013', nome: 'Face Pull no Cabo', grupo: 'costas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0011'], equipamento: 'Cabo', dicas: ['Puxar para altura dos olhos', 'Cotovelos altos', 'Foco em escapulas'], dificuldade: 'facil' },
    { id: '0014', nome: 'Pulldown com Bracos Estendidos', grupo: 'costas', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0008'], equipamento: 'Cabo', dicas: ['Bracos semi-rigidos', 'Puxar ate coxa', 'Nao roubar com lombar'], dificuldade: 'medio' }
  ],
  pernas: [
    { id: '0015', nome: 'Agachamento Livre', grupo: 'pernas', tipo: 'composto', nivel: 'avancado', substitutos: ['0016', '0017'], equipamento: 'Barra', dicas: ['Quadril para tras', 'Joelhos para fora', 'Peito aberto'], dificuldade: 'dificil' },
    { id: '0016', nome: 'Leg Press 45', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0015'], equipamento: 'Maquina', dicas: ['Pes largura dos ombros', 'Nao travar joelhos', 'Lombar colada no banco'], dificuldade: 'medio' },
    { id: '0017', nome: 'Agachamento Goblet', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0015'], equipamento: 'Halteres', dicas: ['Halter perto do peito', 'Descida controlada', 'Subir empurrando o chao'], dificuldade: 'facil' },
    { id: '0018', nome: 'Levantamento Terra Romeno', grupo: 'pernas', tipo: 'composto', nivel: 'intermediario', substitutos: ['0020'], equipamento: 'Barra', dicas: ['Quadril para tras', 'Barra perto da coxa', 'Coluna neutra'], dificuldade: 'medio' },
    { id: '0019', nome: 'Stiff com Halteres', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0018'], equipamento: 'Halteres', dicas: ['Joelho semi-flexionado', 'Alongar posterior', 'Subir com quadril'], dificuldade: 'medio' },
    { id: '0020', nome: 'Cadeira Flexora', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0019'], equipamento: 'Maquina', dicas: ['Quadril fixo no banco', 'Subida forte', 'Retorno lento'], dificuldade: 'facil' },
    { id: '0021', nome: 'Cadeira Extensora', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0016'], equipamento: 'Maquina', dicas: ['Alinhar joelho ao eixo', 'Subir sem tranco', 'Descer controlado'], dificuldade: 'facil' },
    { id: '0022', nome: 'Passada Caminhando', grupo: 'pernas', tipo: 'composto', nivel: 'intermediario', substitutos: ['0017'], equipamento: 'Halteres', dicas: ['Passo medio', 'Tronco alinhado', 'Empurrar pelo calcanhar'], dificuldade: 'medio' },
    { id: '0023', nome: 'Panturrilha em Pe', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0024'], equipamento: 'Maquina', dicas: ['Amplitude completa', 'Pausa no topo', 'Descida lenta'], dificuldade: 'facil' },
    { id: '0024', nome: 'Panturrilha Sentado', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0023'], equipamento: 'Maquina', dicas: ['Amplitude completa', 'Sem impulso', 'Controle na descida'], dificuldade: 'facil' }
  ],
  ombros: [
    { id: '0025', nome: 'Desenvolvimento Militar com Barra', grupo: 'ombros', tipo: 'composto', nivel: 'intermediario', substitutos: ['0026'], equipamento: 'Barra', dicas: ['Abdomen firme', 'Barra sobe reta', 'Nao arquear lombar'], dificuldade: 'medio' },
    { id: '0026', nome: 'Desenvolvimento com Halteres', grupo: 'ombros', tipo: 'composto', nivel: 'iniciante', substitutos: ['0025'], equipamento: 'Halteres', dicas: ['Punhos neutros', 'Subida controlada', 'Descer ate 90 graus'], dificuldade: 'facil' },
    { id: '0027', nome: 'Elevacao Lateral', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0028'], equipamento: 'Halteres', dicas: ['Cotovelo levemente flexionado', 'Subir ate linha do ombro', 'Sem embalo'], dificuldade: 'facil' },
    { id: '0028', nome: 'Elevacao Frontal', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0027'], equipamento: 'Halteres', dicas: ['Subir ate linha dos olhos', 'Controle total', 'Alternar bracos'], dificuldade: 'facil' },
    { id: '0029', nome: 'Crucifixo Inverso no Peck Deck', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0013'], equipamento: 'Maquina', dicas: ['Peito no apoio', 'Abrir com cotovelos', 'Pausa curta no pico'], dificuldade: 'facil' },
    { id: '0030', nome: 'Arnold Press', grupo: 'ombros', tipo: 'composto', nivel: 'intermediario', substitutos: ['0026'], equipamento: 'Halteres', dicas: ['Rotacao fluida', 'Sem perder postura', 'Controle na descida'], dificuldade: 'medio' },
    { id: '0031', nome: 'Desenvolvimento na Maquina', grupo: 'ombros', tipo: 'composto', nivel: 'iniciante', substitutos: ['0026'], equipamento: 'Maquina', dicas: ['Ajustar banco', 'Empurrar em linha', 'Descer completo'], dificuldade: 'facil' }
  ],
  biceps: [
    { id: '0032', nome: 'Rosca Direta com Barra', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0033'], equipamento: 'Barra', dicas: ['Cotovelos fixos', 'Subir sem balancar', 'Descer devagar'], dificuldade: 'facil' },
    { id: '0033', nome: 'Rosca Alternada', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0032'], equipamento: 'Halteres', dicas: ['Supinacao no topo', 'Cotovelos junto ao corpo', 'Controle total'], dificuldade: 'facil' },
    { id: '0034', nome: 'Rosca Martelo', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0033'], equipamento: 'Halteres', dicas: ['Pegada neutra', 'Sem giro de tronco', 'Descida completa'], dificuldade: 'facil' },
    { id: '0035', nome: 'Rosca Scott na Maquina', grupo: 'biceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0032'], equipamento: 'Maquina', dicas: ['Braco apoiado', 'Subida controlada', 'Nao perder tensao'], dificuldade: 'medio' },
    { id: '0036', nome: 'Rosca no Cabo com Barra Reta', grupo: 'biceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0032'], equipamento: 'Cabo', dicas: ['Cotovelos estaveis', 'Pico de contracao', 'Ritmo constante'], dificuldade: 'medio' }
  ],
  triceps: [
    { id: '0037', nome: 'Triceps Corda no Cabo', grupo: 'triceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0038'], equipamento: 'Cabo', dicas: ['Cotovelos fixos', 'Abrir corda no final', 'Voltar sem perder controle'], dificuldade: 'facil' },
    { id: '0038', nome: 'Triceps Frances com Halter', grupo: 'triceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0037'], equipamento: 'Halteres', dicas: ['Cotovelos apontando para frente', 'Amplitude total', 'Sem forcar lombar'], dificuldade: 'medio' },
    { id: '0039', nome: 'Triceps Testa com Barra EZ', grupo: 'triceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0038'], equipamento: 'Barra EZ', dicas: ['Cotovelos estaveis', 'Descer perto da testa', 'Subir com controle'], dificuldade: 'medio' },
    { id: '0040', nome: 'Mergulho entre Bancos', grupo: 'triceps', tipo: 'composto', nivel: 'iniciante', substitutos: ['0037'], equipamento: 'Peso corporal', dicas: ['Quadril proximo ao banco', 'Descer ate 90 graus', 'Subir sem travar'], dificuldade: 'facil' },
    { id: '0041', nome: 'Triceps no Banco com Pegada Fechada', grupo: 'triceps', tipo: 'composto', nivel: 'intermediario', substitutos: ['0039'], equipamento: 'Barra', dicas: ['Pegada fechada firme', 'Cotovelos junto ao corpo', 'Controle da descida'], dificuldade: 'medio' }
  ],
  abdomen: [
    { id: '0042', nome: 'Prancha Frontal', grupo: 'abdomen', tipo: 'composto', nivel: 'iniciante', substitutos: ['0043'], equipamento: 'Peso corporal', dicas: ['Quadril alinhado', 'Abdomen contraido', 'Respiracao controlada'], dificuldade: 'facil' },
    { id: '0043', nome: 'Abdominal Infra no Banco', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0044'], equipamento: 'Banco', dicas: ['Lombar apoiada', 'Subir com controle', 'Nao puxar pescoço'], dificuldade: 'facil' },
    { id: '0044', nome: 'Abdominal na Polia', grupo: 'abdomen', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0043'], equipamento: 'Cabo', dicas: ['Quadril estavel', 'Flexionar tronco', 'Retorno lento'], dificuldade: 'medio' },
    { id: '0045', nome: 'Prancha Lateral', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0042'], equipamento: 'Peso corporal', dicas: ['Corpo em linha reta', 'Quadril alto', 'Manter respiracao'], dificuldade: 'facil' },
    { id: '0046', nome: 'Dead Bug', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0042'], equipamento: 'Peso corporal', dicas: ['Lombar no chao', 'Movimento alternado', 'Controle fino'], dificuldade: 'facil' }
  ],
  cardio: [
    { id: '0047', nome: 'Caminhada Inclinada na Esteira', grupo: 'cardio', tipo: 'composto', nivel: 'iniciante', substitutos: ['0048'], equipamento: 'Esteira', dicas: ['Postura ereta', 'Passo constante', 'Respirar ritmado'], dificuldade: 'facil' },
    { id: '0048', nome: 'Bike Ergometrica', grupo: 'cardio', tipo: 'composto', nivel: 'iniciante', substitutos: ['0047'], equipamento: 'Bicicleta', dicas: ['Selim ajustado', 'Cadencia estavel', 'Nao tensionar ombros'], dificuldade: 'facil' },
    { id: '0049', nome: 'Remo Ergometro', grupo: 'cardio', tipo: 'composto', nivel: 'intermediario', substitutos: ['0048'], equipamento: 'Remo', dicas: ['Pernas iniciam o movimento', 'Tronco neutro', 'Retorno suave'], dificuldade: 'medio' },
    { id: '0050', nome: 'Escada Ergometro', grupo: 'cardio', tipo: 'composto', nivel: 'intermediario', substitutos: ['0047'], equipamento: 'Escada', dicas: ['Passadas curtas', 'Sem apoiar demais nas maos', 'Ritmo constante'], dificuldade: 'medio' }
  ]
};

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const allExercises = Object.values(exerciseDatabase).flat();

export function getExerciseNamesFromDatabase() {
  return allExercises.map((item) => item.nome);
}

export function findExerciseByName(query = '') {
  const normalized = normalize(query);
  if (!normalized) {
    return null;
  }

  const exact = allExercises.find((item) => normalize(item.nome) === normalized);
  if (exact) {
    return exact;
  }

  return allExercises.find((item) => normalize(item.nome).includes(normalized)) || null;
}

export function getExerciseTipsForPain(painText = '') {
  const pain = normalize(painText);
  if (!pain) {
    return [];
  }

  if (pain.includes('ombro')) {
    return allExercises
      .filter((item) => !['peito', 'ombros', 'triceps'].includes(item.grupo) || item.tipo === 'isolado')
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  if (pain.includes('joelho')) {
    return allExercises
      .filter((item) => item.grupo !== 'pernas' || item.nome.includes('Cadeira') || item.nome.includes('Panturrilha'))
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  if (pain.includes('lombar') || pain.includes('coluna')) {
    return allExercises
      .filter((item) => !item.nome.includes('Terra') && !item.nome.includes('Agachamento Livre'))
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  return allExercises.slice(0, 6).map((item) => ({ nome: item.nome, dicas: item.dicas }));
}

export default exerciseDatabase;
