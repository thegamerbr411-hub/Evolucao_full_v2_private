import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { logCriticalError } from './loggingService.js';

export const sendMessage = async (chatId, message, from = 'user') => {
  try {
    if (!db) {
      return false;
    }

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: String(message || ''),
      from,
      createdAt: Date.now(),
    });
    return true;
  } catch (error) {
    await logCriticalError('chatService.sendMessage', error, {
      chatId: String(chatId || ''),
      from,
    });
    return false;
  }
};

export const getRecentMessages = async (chatId, max = 30) => {
  try {
    if (!db) {
      return [];
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(Math.max(1, Number(max || 30)))
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    await logCriticalError('chatService.getRecentMessages', error, {
      chatId: String(chatId || ''),
      max,
    });
    return [];
  }
};

export const subscribeToMessages = ({ chatId, max = 50, onData, onError }) => {
  if (!db) {
    if (typeof onData === 'function') {
      onData([]);
    }

    return () => {};
  }

  const q = query(
    collection(db, 'chats', String(chatId || 'global'), 'messages'),
    orderBy('createdAt', 'desc'),
    limit(Math.max(1, Number(max || 50)))
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .reverse();
      if (typeof onData === 'function') {
        onData(messages);
      }
    },
    async (error) => {
      await logCriticalError('chatService.subscribeToMessages', error, {
        chatId: String(chatId || ''),
      });
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );

  return () => {
    try {
      unsubscribe();
    } catch {
      // silent
    }
  };
};
