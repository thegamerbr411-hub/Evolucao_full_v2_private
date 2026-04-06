const getUserData = () => ({
  peso: (Math.floor(Math.random() * 40) + 60).toString(),
  altura: (Math.floor(Math.random() * 30) + 160).toString(),
  meta: '80',
});

const getWorkoutData = () => ({
  peso: (Math.floor(Math.random() * 40) + 40).toString(),
  reps: (Math.floor(Math.random() * 10) + 8).toString(),
});

module.exports = {
  getUserData,
  getWorkoutData,
};
