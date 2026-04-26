import React from 'react';
import { FlatList } from 'react-native';

const ITEM_HEIGHT = 64;

export default function WorkoutList({ data, renderItem }) {
  return (
    <FlatList
      data={data}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      initialNumToRender={10}
      windowSize={5}
      removeClippedSubviews
    />
  );
}
