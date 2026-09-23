// src/services/fertilizerPurchaseService.js
// 肥料の購入記録。実体は資材共通の materialPurchaseService にあり、
// ここは肥料の画面から使うための入口。
import {
  getPurchases,
  savePurchase,
  deletePurchase,
  findDuplicates,
  mergeMasters
} from './materialPurchaseService';

export const getFertilizerPurchases = (organizationId) =>
  getPurchases('fertilizer', organizationId);

export const saveFertilizerPurchase = (organizationId, purchaseId, data) =>
  savePurchase('fertilizer', organizationId, purchaseId, {
    ...data,
    materialId: data.materialId || data.fertilizerId,
    materialName: data.materialName || data.fertilizerName
  });

export const deleteFertilizerPurchase = (purchaseId, organizationId, deletedByName = '') =>
  deletePurchase('fertilizer', purchaseId, organizationId, deletedByName);

export const findDuplicateFertilizers = (fertilizers = []) =>
  findDuplicates('fertilizer', fertilizers);

export const mergeFertilizers = (organizationId, keep, duplicates, deletedByName = '') =>
  mergeMasters('fertilizer', organizationId, keep, duplicates, deletedByName);
