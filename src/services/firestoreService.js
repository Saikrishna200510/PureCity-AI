import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

// ==================== FAVORITE LOCATIONS ====================

export function subscribeFavorites(userId, callback) {
  if (!db || !userId) return () => {};
  const q = query(
    collection(db, 'favoriteLocations'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addFavoriteLocation(userId, city) {
  if (!db) throw new Error('Firestore not configured');
  return addDoc(collection(db, 'favoriteLocations'), {
    userId,
    locationName: city.name,
    state: city.state || '',
    country: city.country || '',
    lat: Number(city.lat),
    lon: Number(city.lon),
    createdAt: serverTimestamp(),
  });
}

export async function removeFavoriteLocation(favId) {
  if (!db) throw new Error('Firestore not configured');
  return deleteDoc(doc(db, 'favoriteLocations', favId));
}

// ==================== CITIZEN POLLUTION REPORTS ====================

export function subscribeVerifiedReports(callback) {
  if (!db) return () => {};
  const q = query(
    collection(db, 'pollutionReports'),
    where('status', '==', 'verified'),
    orderBy('createdAt', 'desc'),
    limit(40)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeUserReports(userId, callback) {
  if (!db || !userId) return () => {};
  const q = query(
    collection(db, 'pollutionReports'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeAllReportsAdmin(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'pollutionReports'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function uploadReportImage(userId, file) {
  if (!storage) throw new Error('Firebase Storage is not configured.');
  if (!file) return { imageUrl: '', imagePath: '' };
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be 5 MB or smaller.');
  }
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const imagePath = `pollution-reports/${userId}/${safeName}`;
  const storageRef = ref(storage, imagePath);
  await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, imagePath };
}

export async function createPollutionReport({
  userId,
  reporterName,
  locationName,
  category,
  description,
  reportedAt,
  coordinates,
  imageUrl = '',
  imagePath = '',
}) {
  if (!db) throw new Error('Firestore not configured');
  return addDoc(collection(db, 'pollutionReports'), {
    userId,
    reporterName: (reporterName || 'Citizen').slice(0, 60),
    locationName: locationName.trim().slice(0, 120),
    category,
    description: description.trim().slice(0, 1000),
    reportedAt: reportedAt || new Date().toISOString(),
    coordinates: coordinates
      ? { lat: Number(coordinates.lat), lon: Number(coordinates.lon) }
      : null,
    imageUrl,
    imagePath,
    status: 'pending',
    moderationNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function moderatePollutionReport(reportId, status, moderationNote = '') {
  if (!db) throw new Error('Firestore not configured');
  return updateDoc(doc(db, 'pollutionReports', reportId), {
    status,
    moderationNote: moderationNote.slice(0, 300),
    updatedAt: serverTimestamp(),
  });
}

// ==================== USER ALERTS ====================

export function subscribeUserAlerts(userId, callback) {
  if (!db || !userId) return () => {};
  const q = query(
    collection(db, 'userAlerts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createAlertRule({ userId, location, aqiThreshold, standard = 'US', inAppEnabled = true }) {
  if (!db) throw new Error('Firestore not configured');
  return addDoc(collection(db, 'userAlerts'), {
    userId,
    locationName: location.name,
    lat: Number(location.lat),
    lon: Number(location.lon),
    aqiThreshold: Number(aqiThreshold),
    standard,
    inAppEnabled: Boolean(inAppEnabled),
    isActive: true,
    history: [],
    lastTriggeredAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAlertRule(alertId, updates) {
  if (!db) throw new Error('Firestore not configured');
  return updateDoc(doc(db, 'userAlerts', alertId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAlertRule(alertId) {
  if (!db) throw new Error('Firestore not configured');
  return deleteDoc(doc(db, 'userAlerts', alertId));
}

// ==================== CHAT HISTORY ====================

export function subscribeChatConversations(userId, callback) {
  if (!db || !userId) return () => {};
  const q = query(
    collection(db, 'chatHistory'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createChatConversation(userId, title, cityContext) {
  if (!db) throw new Error('Firestore not configured');
  return addDoc(collection(db, 'chatHistory'), {
    userId,
    title: (title || 'Air Quality Chat').slice(0, 100),
    cityContext: cityContext || null,
    messages: [],
    lastInteractionId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function appendChatMessages(conversationId, messages, lastInteractionId = null, title = null) {
  if (!db) throw new Error('Firestore not configured');
  const payload = {
    messages: messages.slice(-40), // Keep bounded per document
    updatedAt: serverTimestamp(),
  };
  if (lastInteractionId) payload.lastInteractionId = lastInteractionId;
  if (title) payload.title = title.slice(0, 100);
  return updateDoc(doc(db, 'chatHistory', conversationId), payload);
}

export async function deleteChatConversation(conversationId) {
  if (!db) throw new Error('Firestore not configured');
  return deleteDoc(doc(db, 'chatHistory', conversationId));
}

// ==================== AIR QUALITY READINGS (PUBLIC CACHE IN FIRESTORE) ====================

export async function fetchStoredReadingsForCity(cityName, maxCount = 48) {
  if (!db || !cityName) return [];
  const q = query(
    collection(db, 'airQualityReadings'),
    where('city', '==', cityName),
    orderBy('timestamp', 'desc'),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchRecentReadingsCount() {
  if (!db) return 0;
  const q = query(collection(db, 'airQualityReadings'), orderBy('timestamp', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.size;
}

// ==================== ADMIN SETTINGS ====================

export async function getAdminSettings() {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'adminSettings', 'global'));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
