import { NextRequest, NextResponse } from 'next/server';
import {
  getCommitteeFeesBySeason,
  getCommitteeFeesByTeam,
  getCommitteeFeeBreakdown
} from '@/lib/committee-fee-reports';

/**
 * GET /api/committee/fee-reports
 * 
 * Fetches committee fee reports for transfers and swaps
 * 
 * Query params:
 *   - season_id: The season to get reports for (required)
 *   - report_type: Type of report - 'by_season', 'by_team', or 'breakdown' (default: 'by_season')
 * 
 * Report Types:
 *   - by_season: Aggregated totals for the entire season
 *   - by_team: Fees paid by each team in the season
 *   - breakdown: Detailed transaction-level breakdown
 * 
 * Requirements: 6.3, 6.4, 6.5, 9.4
 * 
 * @example
 * GET /api/committee/fee-reports?season_id=SSPSLS16&report_type=by_season
 * GET /api/committee/fee-reports?season_id=SSPSLS16&report_type=by_team
 * GET /api/committee/fee-reports?season_id=SSPSLS16&report_type=breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const reportType = searchParams.get('report_type') || 'by_season';

    // Validate required parameters
    if (!seasonId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'season_id is required' 
        },
        { status: 400 }
      );
    }

    // Validate report type
    const validReportTypes = ['by_season', 'by_team', 'breakdown'];
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid report_type. Must be one of: ${validReportTypes.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Execute appropriate report function based on type
    let data: any;

    switch (reportType) {
      case 'by_season':
        data = await getCommitteeFeesBySeason(seasonId);
        break;

      case 'by_team':
        data = await getCommitteeFeesByTeam(seasonId);
        break;

      case 'breakdown':
        data = await getCommitteeFeeBreakdown(seasonId);
        break;

      default:
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid report type' 
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      report_type: reportType,
      season_id: seasonId,
      data
    });

  } catch (error: any) {
    console.error('Error fetching committee fee reports:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch committee fee reports' 
      },
      { status: 500 }
    );
  }
}
