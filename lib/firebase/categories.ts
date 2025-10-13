import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from './config';

// Category interface
export interface Category {
  id: string;
  name: string;
  color: 'red' | 'blue' | 'black' | 'white';
  priority: number; // 1-4, where 1 is highest priority
  
  // Points for Wins (based on level difference)
  points_same_category: number;
  points_one_level_diff: number;
  points_two_level_diff: number;
  points_three_level_diff: number;
  
  // Points for Draws (based on level difference)
  draw_same_category: number;
  draw_one_level_diff: number;
  draw_two_level_diff: number;
  draw_three_level_diff: number;
  
  // Points for Losses (based on level difference)
  loss_same_category: number;
  loss_one_level_diff: number;
  loss_two_level_diff: number;
  loss_three_level_diff: number;
  
  // Metadata
  created_at: Date;
  updated_at?: Date;
}

export interface CreateCategoryData {
  name: string;
  color: 'red' | 'blue' | 'black' | 'white';
  priority: number;
  
  points_same_category: number;
  points_one_level_diff: number;
  points_two_level_diff: number;
  points_three_level_diff: number;
  
  draw_same_category: number;
  draw_one_level_diff: number;
  draw_two_level_diff: number;
  draw_three_level_diff: number;
  
  loss_same_category: number;
  loss_one_level_diff: number;
  loss_two_level_diff: number;
  loss_three_level_diff: number;
}

export interface UpdateCategoryData {
  name?: string;
  color?: 'red' | 'blue' | 'black' | 'white';
  priority?: number;
  
  points_same_category?: number;
  points_one_level_diff?: number;
  points_two_level_diff?: number;
  points_three_level_diff?: number;
  
  draw_same_category?: number;
  draw_one_level_diff?: number;
  draw_two_level_diff?: number;
  draw_three_level_diff?: number;
  
  loss_same_category?: number;
  loss_one_level_diff?: number;
  loss_two_level_diff?: number;
  loss_three_level_diff?: number;
}

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate();
  }
  return new Date();
};

// Generate category ID
const generateCategoryId = (name: string): string => {
  return `cat_${name.toLowerCase().replace(/\s+/g, '_')}`;
};

/**
 * Get all categories ordered by priority
 */
export const getAllCategories = async (): Promise<Category[]> => {
  try {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, orderBy('priority', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const categories: Category[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      categories.push({
        ...data,
        id: docSnap.id,
        created_at: convertTimestamp(data.created_at),
        updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
      } as Category);
    });
    
    return categories;
  } catch (error) {
    console.error('Error getting all categories:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get categories';
    throw new Error(errorMessage);
  }
};

/**
 * Get category by ID
 */
export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  try {
    const categoryRef = doc(db, 'categories', categoryId);
    const categoryDoc = await getDoc(categoryRef);
    
    if (!categoryDoc.exists()) {
      return null;
    }
    
    const data = categoryDoc.data();
    return {
      ...data,
      id: categoryDoc.id,
      created_at: convertTimestamp(data.created_at),
      updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
    } as Category;
  } catch (error) {
    console.error('Error getting category by ID:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get category';
    throw new Error(errorMessage);
  }
};

/**
 * Get category by name
 */
export const getCategoryByName = async (name: string): Promise<Category | null> => {
  try {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, where('name', '==', name));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const data = querySnapshot.docs[0].data();
    return {
      ...data,
      id: querySnapshot.docs[0].id,
      created_at: convertTimestamp(data.created_at),
      updated_at: data.updated_at ? convertTimestamp(data.updated_at) : undefined,
    } as Category;
  } catch (error) {
    console.error('Error getting category by name:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get category';
    throw new Error(errorMessage);
  }
};

/**
 * Create new category
 */
export const createCategory = async (categoryData: CreateCategoryData): Promise<Category> => {
  try {
    // Validate priority is between 1-4
    if (categoryData.priority < 1 || categoryData.priority > 4) {
      throw new Error('Priority must be between 1 and 4');
    }
    
    // Check if category with same name already exists
    const existingCategory = await getCategoryByName(categoryData.name);
    if (existingCategory) {
      throw new Error(`Category with name "${categoryData.name}" already exists`);
    }
    
    // Check if priority is already taken
    const categoriesRef = collection(db, 'categories');
    const priorityQuery = query(categoriesRef, where('priority', '==', categoryData.priority));
    const prioritySnapshot = await getDocs(priorityQuery);
    if (!prioritySnapshot.empty) {
      throw new Error(`Priority ${categoryData.priority} is already assigned to another category`);
    }
    
    // Generate category ID
    const categoryId = generateCategoryId(categoryData.name);
    const categoryRef = doc(db, 'categories', categoryId);
    
    const newCategory = {
      name: categoryData.name,
      color: categoryData.color,
      priority: categoryData.priority,
      
      points_same_category: categoryData.points_same_category,
      points_one_level_diff: categoryData.points_one_level_diff,
      points_two_level_diff: categoryData.points_two_level_diff,
      points_three_level_diff: categoryData.points_three_level_diff,
      
      draw_same_category: categoryData.draw_same_category,
      draw_one_level_diff: categoryData.draw_one_level_diff,
      draw_two_level_diff: categoryData.draw_two_level_diff,
      draw_three_level_diff: categoryData.draw_three_level_diff,
      
      loss_same_category: categoryData.loss_same_category,
      loss_one_level_diff: categoryData.loss_one_level_diff,
      loss_two_level_diff: categoryData.loss_two_level_diff,
      loss_three_level_diff: categoryData.loss_three_level_diff,
      
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    
    await setDoc(categoryRef, newCategory);
    
    // Fetch and return the created category
    const createdCategory = await getCategoryById(categoryId);
    if (!createdCategory) {
      throw new Error('Failed to fetch created category');
    }
    
    return createdCategory;
  } catch (error) {
    console.error('Error creating category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create category';
    throw new Error(errorMessage);
  }
};

/**
 * Update category
 */
export const updateCategory = async (
  categoryId: string,
  updates: UpdateCategoryData
): Promise<void> => {
  try {
    const categoryRef = doc(db, 'categories', categoryId);
    const categoryDoc = await getDoc(categoryRef);
    
    if (!categoryDoc.exists()) {
      throw new Error('Category not found');
    }
    
    // If updating priority, check if new priority is already taken
    if (updates.priority !== undefined) {
      if (updates.priority < 1 || updates.priority > 4) {
        throw new Error('Priority must be between 1 and 4');
      }
      
      const categoriesRef = collection(db, 'categories');
      const priorityQuery = query(categoriesRef, where('priority', '==', updates.priority));
      const prioritySnapshot = await getDocs(priorityQuery);
      
      // Check if priority is taken by a different category
      const conflictingCategory = prioritySnapshot.docs.find(doc => doc.id !== categoryId);
      if (conflictingCategory) {
        throw new Error(`Priority ${updates.priority} is already assigned to another category`);
      }
    }
    
    // If updating name, check if new name already exists
    if (updates.name !== undefined && updates.name !== categoryDoc.data().name) {
      const existingCategory = await getCategoryByName(updates.name);
      if (existingCategory && existingCategory.id !== categoryId) {
        throw new Error(`Category with name "${updates.name}" already exists`);
      }
    }
    
    await updateDoc(categoryRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update category';
    throw new Error(errorMessage);
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    // Check if any players are using this category
    const playersRef = collection(db, 'realplayers');
    const playersQuery = query(playersRef, where('category_id', '==', categoryId));
    const playersSnapshot = await getDocs(playersQuery);
    
    if (!playersSnapshot.empty) {
      throw new Error(
        `Cannot delete category. ${playersSnapshot.size} player(s) are assigned to this category. Please reassign them first.`
      );
    }
    
    const categoryRef = doc(db, 'categories', categoryId);
    await deleteDoc(categoryRef);
  } catch (error) {
    console.error('Error deleting category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
    throw new Error(errorMessage);
  }
};

/**
 * Calculate points for a match result
 * @param winnerCategoryId - Category ID of the winner
 * @param loserCategoryId - Category ID of the loser
 * @param result - Match result: 'win', 'draw', or 'loss'
 * @returns Points to be awarded
 */
export const calculateMatchPoints = async (
  playerCategoryId: string,
  opponentCategoryId: string,
  result: 'win' | 'draw' | 'loss'
): Promise<number> => {
  try {
    const playerCategory = await getCategoryById(playerCategoryId);
    const opponentCategory = await getCategoryById(opponentCategoryId);
    
    if (!playerCategory || !opponentCategory) {
      throw new Error('Invalid category IDs');
    }
    
    // Calculate level difference based on priority
    const levelDiff = Math.abs(playerCategory.priority - opponentCategory.priority);
    
    // Determine which points field to use
    let points = 0;
    
    if (result === 'win') {
      if (levelDiff === 0) points = playerCategory.points_same_category;
      else if (levelDiff === 1) points = playerCategory.points_one_level_diff;
      else if (levelDiff === 2) points = playerCategory.points_two_level_diff;
      else points = playerCategory.points_three_level_diff;
    } else if (result === 'draw') {
      if (levelDiff === 0) points = playerCategory.draw_same_category;
      else if (levelDiff === 1) points = playerCategory.draw_one_level_diff;
      else if (levelDiff === 2) points = playerCategory.draw_two_level_diff;
      else points = playerCategory.draw_three_level_diff;
    } else if (result === 'loss') {
      if (levelDiff === 0) points = playerCategory.loss_same_category;
      else if (levelDiff === 1) points = playerCategory.loss_one_level_diff;
      else if (levelDiff === 2) points = playerCategory.loss_two_level_diff;
      else points = playerCategory.loss_three_level_diff;
    }
    
    return points;
  } catch (error) {
    console.error('Error calculating match points:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate match points';
    throw new Error(errorMessage);
  }
};

/**
 * Initialize default categories (Red, Blue, Black, White)
 * Use this for initial setup
 */
export const initializeDefaultCategories = async (): Promise<void> => {
  try {
    const defaultCategories: CreateCategoryData[] = [
      {
        name: 'Red',
        color: 'red',
        priority: 1,
        points_same_category: 8,
        points_one_level_diff: 7,
        points_two_level_diff: 6,
        points_three_level_diff: 5,
        draw_same_category: 4,
        draw_one_level_diff: 3,
        draw_two_level_diff: 3,
        draw_three_level_diff: 2,
        loss_same_category: 1,
        loss_one_level_diff: 1,
        loss_two_level_diff: 1,
        loss_three_level_diff: 0,
      },
      {
        name: 'Blue',
        color: 'blue',
        priority: 2,
        points_same_category: 8,
        points_one_level_diff: 7,
        points_two_level_diff: 6,
        points_three_level_diff: 5,
        draw_same_category: 4,
        draw_one_level_diff: 3,
        draw_two_level_diff: 3,
        draw_three_level_diff: 2,
        loss_same_category: 1,
        loss_one_level_diff: 1,
        loss_two_level_diff: 1,
        loss_three_level_diff: 0,
      },
      {
        name: 'Black',
        color: 'black',
        priority: 3,
        points_same_category: 8,
        points_one_level_diff: 7,
        points_two_level_diff: 6,
        points_three_level_diff: 5,
        draw_same_category: 4,
        draw_one_level_diff: 3,
        draw_two_level_diff: 3,
        draw_three_level_diff: 2,
        loss_same_category: 1,
        loss_one_level_diff: 1,
        loss_two_level_diff: 1,
        loss_three_level_diff: 0,
      },
      {
        name: 'White',
        color: 'white',
        priority: 4,
        points_same_category: 8,
        points_one_level_diff: 7,
        points_two_level_diff: 6,
        points_three_level_diff: 5,
        draw_same_category: 4,
        draw_one_level_diff: 3,
        draw_two_level_diff: 3,
        draw_three_level_diff: 2,
        loss_same_category: 1,
        loss_one_level_diff: 1,
        loss_two_level_diff: 1,
        loss_three_level_diff: 0,
      },
    ];
    
    for (const categoryData of defaultCategories) {
      const existing = await getCategoryByName(categoryData.name);
      if (!existing) {
        await createCategory(categoryData);
        console.log(`Created default category: ${categoryData.name}`);
      }
    }
    
    console.log('Default categories initialized successfully');
  } catch (error) {
    console.error('Error initializing default categories:', error);
    throw error;
  }
};
