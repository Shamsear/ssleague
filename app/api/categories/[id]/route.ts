import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
  UpdateCategoryData,
} from '@/lib/firebase/categories';

/**
 * GET /api/categories/[id]
 * Get a single category by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = await getCategoryById(params.id);
    
    if (!category) {
      return NextResponse.json(
        {
          success: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch category',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/categories/[id]
 * Update a category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Validate color if provided
    if (body.color) {
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
    }
    
    // Validate priority if provided
    if (body.priority !== undefined) {
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
    }
    
    // Validate points if provided
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
      if (body[field] !== undefined) {
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
    }
    
    // Build update object
    const updates: UpdateCategoryData = {};
    
    if (body.name) updates.name = body.name.trim();
    if (body.color) updates.color = body.color;
    if (body.priority !== undefined) updates.priority = parseInt(body.priority);
    
    // Add point updates
    for (const field of pointFields) {
      if (body[field] !== undefined) {
        (updates as any)[field] = parseInt(body[field]);
      }
    }
    
    await updateCategory(params.id, updates);
    
    // Fetch updated category
    const updatedCategory = await getCategoryById(params.id);
    
    return NextResponse.json({
      success: true,
      data: updatedCategory,
      message: 'Category updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update category',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id]
 * Delete a category
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteCategory(params.id);
    
    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete category',
      },
      { status: 500 }
    );
  }
}
