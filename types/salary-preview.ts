// This file will be created to show the preview of salary deductions
// Will add this functionality to the existing page

export interface TeamSalaryPreview {
    teamId: string;
    teamName: string;
    playerCount: number;
    totalSalary: number;
    currentBalance: number;
    newBalance: number;
    canAfford: boolean;
    players: {
        name: string;
        auctionValue: number;
        salary: number;
    }[];
}
