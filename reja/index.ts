/**
 * Kirish nuqtasi.
 *
 * Fon vazifasi (bildirishnomadagi "Bajarildi ✓" tugmasi) expo-router yuklanishidan
 * OLDIN, global darajada eʼlon qilinishi shart: ilova yopiq boʻlganda Android
 * JS'ni "headless" rejimda ishga tushiradi va hech qanday ekran render qilinmaydi —
 * route fayllari umuman yuklanmaydi. Vazifa shu yerda boʻlmasa, tugma jimgina
 * ishlamay qoladi.
 */
import './src/lib/background';
import 'expo-router/entry';
