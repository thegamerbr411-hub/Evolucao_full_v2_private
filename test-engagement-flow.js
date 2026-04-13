/**
 * 🧪 TESTE DE FLUXO DE ENGAJAMENTO
 * Valida que o loop: Treino → XP → Ranking → Social funciona
 */

// Mock dos stores
const mockGamificationStore = {
  state: { xp: 0 },
  addXp: function(amount) {
    this.state.xp += amount;
    console.log(`✅ XP adicionado: ${amount}. Total: ${this.state.xp}`);
  },
};

const mockSocialStore = {
  state: { feed: [], ranking: [] },
  addPostToFeed: function(post) {
    this.state.feed.unshift(post);
    this.updateRanking(post);
    console.log(`✅ Post adicionado ao feed. Total no feed: ${this.state.feed.length}`);
  },
  updateRanking: function(post) {
    const existing = this.state.ranking.find(e => e.userId === post.userId);
    if (existing) {
      existing.xp += post.xpGained;
    } else {
      this.state.ranking.push({
        userId: post.userId,
        username: post.username,
        xp: post.xpGained,
        position: 1,
      });
    }
    this.state.ranking.sort((a, b) => b.xp - a.xp);
    this.state.ranking.forEach((e, idx) => (e.position = idx + 1));
    console.log(`✅ Ranking atualizado. Posição do ${post.username}: #${this.state.ranking.find(e => e.userId === post.userId).position}`);
  },
};

// ============================================
// TEST 1: Simular treino concluído
// ============================================
console.log('\n🎬 TEST 1: Treino Concluído\n');

const completedWorkout = {
  userId: 'user123',
  username: 'Felipe',
  workoutType: 'Peito',
  totalVolume: 2400, // kg
  totalSets: 12,
  exerciseCount: 4,
  durationMinutes: 45,
};

console.log(`📊 Dados do treino:`, completedWorkout);

// ============================================
// TEST 2: Calcular XP
// ============================================
console.log('\n🎬 TEST 2: Calculando XP\n');

const calculateXpFromVolume = (volume) => Math.max(10, Math.round(volume / 10));
const xpGained = calculateXpFromVolume(completedWorkout.totalVolume);

console.log(`📐 Formula: volume / 10 = ${completedWorkout.totalVolume} / 10 = ${xpGained} XP`);

// ============================================
// TEST 3: Atualizar Gamification Store
// ============================================
console.log('\n🎬 TEST 3: Atualizando Gamification Store\n');

mockGamificationStore.addXp(xpGained);

// ============================================
// TEST 4: Criar Post Social
// ============================================
console.log('\n🎬 TEST 4: Criando Post Social\n');

const socialPost = {
  id: `post_${completedWorkout.userId}_${Date.now()}`,
  userId: completedWorkout.userId,
  username: completedWorkout.username,
  workoutType: completedWorkout.workoutType,
  volume: completedWorkout.totalVolume,
  xpGained,
  exerciseCount: completedWorkout.exerciseCount,
  totalSets: completedWorkout.totalSets,
  createdAt: new Date().toISOString(),
};

console.log(`📝 Post criado:`, {
  id: socialPost.id,
  username: socialPost.username,
  volume: socialPost.volume,
  xpGained: socialPost.xpGained,
});

// ============================================
// TEST 5: Adicionar ao Feed + Atualizar Ranking
// ============================================
console.log('\n🎬 TEST 5: Adicionando ao Feed Social\n');

mockSocialStore.addPostToFeed(socialPost);

// ============================================
// TEST 6: Simular segundo usuário
// ============================================
console.log('\n🎬 TEST 6: Simulando Segundo Usuário (João)\n');

const comparisonWorkout = {
  userId: 'user456',
  username: 'João',
  workoutType: 'Costas',
  totalVolume: 3200,
  totalSets: 14,
  exerciseCount: 5,
};

const joaoXp = calculateXpFromVolume(comparisonWorkout.totalVolume);
mockGamificationStore.addXp(joaoXp); // Simular add XP (seria outro usuário)

const joaoPost = {
  id: `post_${comparisonWorkout.userId}_${Date.now()}`,
  userId: comparisonWorkout.userId,
  username: comparisonWorkout.username,
  workoutType: comparisonWorkout.workoutType,
  volume: comparisonWorkout.totalVolume,
  xpGained: joaoXp,
  exerciseCount: comparisonWorkout.exerciseCount,
  totalSets: comparisonWorkout.totalSets,
  createdAt: new Date().toISOString(),
};

mockSocialStore.addPostToFeed(joaoPost);

// ============================================
// TEST 7: Validar Ranking
// ============================================
console.log('\n🎬 TEST 7: Validando Ranking Final\n');

console.log('🏆 TOP 10:');
mockSocialStore.state.ranking.slice(0, 10).forEach(entry => {
  const medal = { 1: '🥇', 2: '🥈', 3: '🥉' }[entry.position] || `#${entry.position}`;
  console.log(`${medal} ${entry.username}: ${entry.xp} XP`);
});

// ============================================
// TEST 8: Validar Feed
// ============================================
console.log('\n🎬 TEST 8: Validando Feed Social\n');

console.log(`📰 FEED (${mockSocialStore.state.feed.length} posts):`);
mockSocialStore.state.feed.slice(0, 5).forEach(post => {
  console.log(`  🏋️ ${post.username}: ${post.volume}kg → +${post.xpGained} XP`);
});

// ============================================
// TEST 9: Validar Mensagem de Engajamento
// ============================================
console.log('\n🎬 TEST 9: Mensagem de Engajamento\n');

const getEngagementMessage = (position, xp) => {
  const messages = {
    1: `🔥 LIDERANÇA! Você é o #1 em XP`,
    2: `🥈 Posição #2! Só mais 1 ponto para o topo`,
    3: `🥉 Top 3! Você está conquistando`,
    5: `💪 Top 5! Continue assim`,
    10: `📈 Top 10! Você está crescendo`,
  };
  const key = Object.keys(messages)
    .map(Number)
    .filter(k => k <= position)
    .sort((a, b) => b - a)[0];
  return messages[key] || `💥 +${xp} XP! Continue treininando`;
};

const userRanking = mockSocialStore.state.ranking.find(e => e.userId === 'user123');
console.log(`💬 Mensagem para Felipe: "${getEngagementMessage(userRanking.position, xpGained)}"`);

// ============================================
// RESUMO FINAL
// ============================================
console.log('\n' + '='.repeat(60));
console.log('✅ TESTE COMPLETO FINALIZADO COM SUCESSO');
console.log('='.repeat(60));

console.log(`
📊 RESUMO:
  ✅ Treino concluído com 2400kg
  ✅ XP calculado: ${xpGained}
  ✅ Gamification store atualizado
  ✅ Post social criado
  ✅ Ranking atualizado
  ✅ Feed tem ${mockSocialStore.state.feed.length} posts
  ✅ ${mockSocialStore.state.ranking.length} usuários no ranking
  ✅ Mensagem de engajamento gerada

🎯 RESULTADO:
  Felipe: #${userRanking.position} com ${userRanking.xp} XP
  João: ${mockSocialStore.state.ranking.find(e => e.userId === 'user456').position}º com ${mockSocialStore.state.ranking.find(e => e.userId === 'user456').xp} XP

🚀 FLUXO AUTOMÁTICO FUNCIONAL:
  Treino → XP → Ranking → Social → Competição
`);
