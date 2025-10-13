import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCategories,
  createCategory,
  CreateCategoryData,
} from '@/lib/firebase/categories';

/**
 * GET /api/categories
 * Get all categories
 */
export async function GET() {
  try {
    const categories = await getAllCategories();
    
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
      'color',
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
    
    // Validate color
    const validColors = ['red', 'blue', 'black', 'white'];
    if (!validColors.includes(body.color)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid color. Must be one of: ${validColors.join(', ')}`,
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
    
    const categoryData: CreateCategoryData = {
      name: body.name.trim(),
      color: body.color,
      priority: parseInt(body.priority),
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
    };
    
    const category = await createCategory(categoryData);
    
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
