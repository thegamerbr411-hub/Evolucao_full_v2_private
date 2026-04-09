export const parseWorkoutFromImage = async (imageUri) => {
  return {
    name: 'Treino via imagem',
    sourceImage: imageUri || null,
    exercises: [],
  };
};
