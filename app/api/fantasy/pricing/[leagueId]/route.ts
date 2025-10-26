import { NextRequest, NextResponse } from "next/server";
import { fantasySql } from "@/lib/neon/fantasy-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;

    const result = await fantasySql`
      SELECT star_rating_prices 
      FROM fantasy_leagues 
      WHERE league_id = ${leagueId}
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    // Return existing pricing or default if null (3-10 star system)
    const pricing = result[0].star_rating_prices || [
      { stars: 3, price: 5 },
      { stars: 4, price: 7 },
      { stars: 5, price: 10 },
      { stars: 6, price: 13 },
      { stars: 7, price: 16 },
      { stars: 8, price: 20 },
      { stars: 9, price: 25 },
      { stars: 10, price: 30 },
    ];

    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("Error fetching star rating pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const { pricing } = await request.json();

    // Validate pricing structure (3-10 star system = 8 tiers)
    if (!Array.isArray(pricing) || pricing.length !== 8) {
      return NextResponse.json(
        { error: "Invalid pricing structure - must have 8 tiers (3-10 stars)" },
        { status: 400 }
      );
    }

    // Validate each pricing entry
    for (const item of pricing) {
      if (
        typeof item.stars !== "number" ||
        typeof item.price !== "number" ||
        item.stars < 3 ||
        item.stars > 10 ||
        item.price <= 0
      ) {
        return NextResponse.json(
          { error: "Invalid pricing data - stars must be 3-10, price must be > 0" },
          { status: 400 }
        );
      }
    }

    // Update star_rating_prices in fantasy_leagues table
    await fantasySql`
      UPDATE fantasy_leagues 
      SET star_rating_prices = ${JSON.stringify(pricing)}, 
          updated_at = CURRENT_TIMESTAMP
      WHERE league_id = ${leagueId}
    `;

    return NextResponse.json({
      success: true,
      message: "Pricing updated successfully",
    });
  } catch (error) {
    console.error("Error updating star rating pricing:", error);
    return NextResponse.json(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}
