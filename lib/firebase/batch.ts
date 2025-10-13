import { adminDb } from './admin';

/**
 * Batch fetch documents from a Firebase collection
 * @param collection - The Firebase collection name
 * @param ids - Array of document IDs to fetch
 * @returns Map of document ID to document data
 */
export async function batchGetFirebase<T = any>(
  collection: string,
  ids: string[]
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  
  if (ids.length === 0) {
    return results;
  }

  // Remove duplicates
  const uniqueIds = Array.from(new Set(ids));

  // Firebase getAll() can handle up to 10 documents at a time
  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  // Fetch all batches in parallel
  const batchPromises = batches.map(async (batch) => {
    const docRefs = batch.map(id => adminDb.collection(collection).doc(id));
    const docs = await adminDb.getAll(...docRefs);
    
    return docs.map((doc, index) => ({
      id: batch[index],
      data: doc.exists ? doc.data() as T : null,
    }));
  });

  const batchResults = await Promise.all(batchPromises);

  // Flatten results and build map
  for (const batchResult of batchResults) {
    for (const item of batchResult) {
      if (item.data) {
        results.set(item.id, item.data);
      }
    }
  }

  return results;
}

/**
 * Batch fetch specific fields from documents in a Firebase collection
 * Useful when you only need certain fields to reduce data transfer
 */
export async function batchGetFirebaseFields<T = any>(
  collection: string,
  ids: string[],
  fields: string[]
): Promise<Map<string, Partial<T>>> {
  const results = new Map<string, Partial<T>>();
  
  if (ids.length === 0) {
    return results;
  }

  const uniqueIds = Array.from(new Set(ids));
  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    batches.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = batches.map(async (batch) => {
    const docRefs = batch.map(id => adminDb.collection(collection).doc(id));
    const docs = await adminDb.getAll(...docRefs);
    
    return docs.map((doc, index) => {
      if (!doc.exists) {
        return { id: batch[index], data: null };
      }
      
      const fullData = doc.data();
      const filteredData: any = {};
      
      for (const field of fields) {
        if (fullData && field in fullData) {
          filteredData[field] = fullData[field];
        }
      }
      
      return {
        id: batch[index],
        data: filteredData as Partial<T>,
      };
    });
  });

  const batchResults = await Promise.all(batchPromises);

  for (const batchResult of batchResults) {
    for (const item of batchResult) {
      if (item.data) {
        results.set(item.id, item.data);
      }
    }
  }

  return results;
}
