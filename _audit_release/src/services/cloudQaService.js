let db;
let addDoc, collection;

try {
  const firebase = require('firebase/firestore');
  db = firebase.getFirestore();
  addDoc = firebase.addDoc;
  collection = firebase.collection;
} catch {
  console.log('Firebase não configurado ainda');
}

async function sendBugToCloud(bug) {
  if (!db) return;

  try {
    await addDoc(collection(db, 'qa_logs'), bug);
  } catch (e) {
    console.log('cloud bug error:', e.message);
  }
}

async function sendChartToCloud(chart) {
  if (!db) return;

  try {
    await addDoc(collection(db, 'qa_chart'), {
      data: chart,
      createdAt: Date.now()
    });
  } catch (e) {
    console.log('cloud chart error:', e.message);
  }
}

module.exports = { sendBugToCloud, sendChartToCloud };
