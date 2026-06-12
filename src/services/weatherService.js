// src/services/weatherService.js
// Open-Meteo API（無料・APIキー不要）から指定日の天気を取得し、
// 防除記録の天候・気温・風速を自動入力するためのサービス。
// https://open-meteo.com/
import { firestoreLogger } from '../utils/logger';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// WMO天気コード → アプリの天候選択肢（晴れ/薄曇り/曇り/霧/雨）
const weatherCodeToLabel = (code) => {
  if (code === 0 || code === 1) return '晴れ';
  if (code === 2) return '薄曇り';
  if (code === 3) return '曇り';
  if (code === 45 || code === 48) return '霧';
  // 51以上は霧雨・雨・雪・雷雨など降水系
  if (code >= 51) return '雨';
  return '曇り';
};

/**
 * 現在地の位置情報を取得
 */
export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('この端末では位置情報を利用できません'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  });

/**
 * 指定日・指定地点の天気を取得
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<{weather: string, temperature: string, windSpeed: string}|null>}
 */
export const fetchWeatherForDate = async (latitude, longitude, dateStr) => {
  try {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const ageDays = (Date.now() - targetDate.getTime()) / MS_PER_DAY;

    // 約3ヶ月より前は過去気象アーカイブAPI、それ以降は通常APIを使用
    const host = ageDays > 85
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const params = new URLSearchParams({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max',
      windspeed_unit: 'ms',
      timezone: 'Asia/Tokyo',
      start_date: dateStr,
      end_date: dateStr
    });

    const response = await fetch(`${host}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }
    const json = await response.json();
    const daily = json.daily;
    if (!daily || daily.weathercode?.[0] === undefined || daily.weathercode?.[0] === null) {
      return null;
    }

    const tempMax = daily.temperature_2m_max?.[0];
    const tempMin = daily.temperature_2m_min?.[0];
    const temperature = tempMax !== null && tempMin !== null && tempMax !== undefined
      ? ((tempMax + tempMin) / 2).toFixed(1)
      : '';
    const windSpeed = daily.windspeed_10m_max?.[0] !== undefined && daily.windspeed_10m_max?.[0] !== null
      ? daily.windspeed_10m_max[0].toFixed(1)
      : '';

    return {
      weather: weatherCodeToLabel(daily.weathercode[0]),
      temperature,
      windSpeed
    };
  } catch (err) {
    firestoreLogger.error('天気情報の取得エラー', { dateStr }, err);
    throw err;
  }
};
