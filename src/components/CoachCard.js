import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

function CoachCard({ insight, onAction }) {
  return (
    <View
      style={{
        backgroundColor: '#111',
        padding: 20,
        borderRadius: 16,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16 }}>{insight?.message}</Text>

      {insight?.action !== 'NONE' ? (
        <TouchableOpacity
          onPress={() => onAction(insight.action)}
          style={{
            marginTop: 12,
            backgroundColor: '#fff',
            padding: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontWeight: 'bold' }}>FAZER AGORA</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default React.memo(CoachCard);
