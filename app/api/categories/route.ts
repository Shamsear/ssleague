import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/categories
 * Get all categories
 */
export async function GET() {
  try {
    // Use Admin SDK to fetch categories
    const categoriesSnapshot = await adminDb
      .collection('categories')
      .orderBy('priority', 'asc')
      .get();
    
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return NextResponse.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch categories',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/categories
 * Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = [
      'name',
      'priority',
      'points_same_category',
      'points_one_level_diff',
      'points_two_level_diff',
      'points_three_level_diff',
      'draw_same_category',
      'draw_one_level_diff',
      'draw_two_level_diff',
      'draw_three_level_diff',
      'loss_same_category',
      'loss_one_level_diff',
      'loss_two_level_diff',
      'loss_three_level_diff',
    ];
    
    const missingFields = requiredFields.filter(field => !(field in body));
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }
    
    // Validate priority
    const priority = parseInt(body.priority);
    if (isNaN(priority) || priority < 1 || priority > 4) {
      return NextResponse.json(
        {
          success: false,
          error: 'Priority must be a number between 1 and 4',
        },
        { status: 400 }
      );
    }
    
    // Validate points are within range (-20 to 20)
    const pointFields = [
      'points_same_category',
      'points_one_level_diff',
      'points_two_level_diff',
      'points_three_level_diff',
      'draw_same_category',
      'draw_one_level_diff',
      'draw_two_level_diff',
      'draw_three_level_diff',
      'loss_same_category',
      'loss_one_level_diff',
      'loss_two_level_diff',
      'loss_three_level_diff',
    ];
    
    for (const field of pointFields) {
      const value = parseInt(body[field]);
      if (isNaN(value) || value < -20 || value > 20) {
        return NextResponse.json(
          {
            success: false,
            error: `${field} must be a number between -20 and 20`,
          },
          { status: 400 }
        );
      }
    }
    
    // Check if category with same name exists
    const existingCategorySnapshot = await adminDb
      .collection('categories')
      .where('name', '==', body.name.trim())
      .limit(1)
      .get();
    
    if (!existingCategorySnapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          error: `Category with name "${body.name.trim()}" already exists`,
        },
        { status: 400 }
      );
    }
    
    // Check if priority is already taken
    const prioritySnapshot = await adminDb
      .collection('categories')
      .where('priority', '==', priority)
      .limit(1)
      .get();
    
    if (!prioritySnapshot.empty) {
      return NextResponse.json(
        {
          success: false,
          error: `Priority ${priority} is already assigned to another category`,
        },
        { status: 400 }
      );
    }
    
    // Generate category ID
    const categoryId = `cat_${body.name.trim().toLowerCase().replace(/\s+/g, '_')}`;
    
    const categoryData = {
      name: body.name.trim(),
      icon: body.icon || '⭐',
      priority: priority,
      points_same_category: parseInt(body.points_same_category),
      points_one_level_diff: parseInt(body.points_one_level_diff),
      points_two_level_diff: parseInt(body.points_two_level_diff),
      points_three_level_diff: parseInt(body.points_three_level_diff),
      draw_same_category: parseInt(body.draw_same_category),
      draw_one_level_diff: parseInt(body.draw_one_level_diff),
      draw_two_level_diff: parseInt(body.draw_two_level_diff),
      draw_three_level_diff: parseInt(body.draw_three_level_diff),
      loss_same_category: parseInt(body.loss_same_category),
      loss_one_level_diff: parseInt(body.loss_one_level_diff),
      loss_two_level_diff: parseInt(body.loss_two_level_diff),
      loss_three_level_diff: parseInt(body.loss_three_level_diff),
      created_at: new Date(),
    };
    
    // Create category using Admin SDK
    await adminDb.collection('categories').doc(categoryId).set(categoryData);
    
    const category = {
      id: categoryId,
      ...categoryData,
    };
    
    return NextResponse.json(
      {
        success: true,
        data: category,
        message: 'Category created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create category',
      },
      { status: 500 }
    );
  }
}
