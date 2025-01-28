// Function to update auction status
function updateAuctionStatus() {
    fetch('/auction/updates')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Update available players
            data.available_players.forEach(player => {
                const bidElement = document.getElementById(`currentBid_${player.id}`);
                const teamElement = document.getElementById(`currentTeam_${player.id}`);
                if (bidElement) bidElement.textContent = player.current_bid || player.base_price;
                if (teamElement) teamElement.textContent = '-';
            });

            // Update sold players
            data.sold_players.forEach(player => {
                const bidElement = document.getElementById(`currentBid_${player.id}`);
                const teamElement = document.getElementById(`currentTeam_${player.id}`);
                if (bidElement) bidElement.textContent = player.current_bid;
                if (teamElement) teamElement.textContent = player.team.team_name;
            });

            // Update remaining budget if element exists
            const budgetElement = document.getElementById('remainingBudget');
            if (budgetElement) {
                budgetElement.textContent = data.remaining_budget;
            }
        })
        .catch(error => {
            console.error('Error updating auction status:', error);
        });
}

// Function to show round results
function showRoundResults(roundId) {
    fetch(`/api/round-results/${roundId}`)
        .then(response => response.json())
        .then(data => {
            const modalContent = document.getElementById('roundResultsContent');
            modalContent.innerHTML = `
                <h4>${data.position} Round Results</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Winning Team</th>
                            <th>Final Bid</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.results.map(result => `
                            <tr>
                                <td>${result.player_name}</td>
                                <td>${result.team_name}</td>
                                <td>${result.final_bid}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            
            const modal = new bootstrap.Modal(document.getElementById('roundResultsModal'));
            modal.show();
        });
}

// Update auction status every 5 seconds if on auction page
if (document.getElementById('timeRemaining')) {
    setInterval(updateAuctionStatus, 5000);
}

// Admin dashboard updates
function updateAdminDashboard() {
    if (document.getElementById('currentRoundStatus')) {
        fetch('/api/admin/current-round')
            .then(response => response.json())
            .then(data => {
                document.getElementById('currentRoundStatus').innerHTML = `
                    <p><strong>Position:</strong> ${data.position || 'No active round'}</p>
                    <p><strong>Time Remaining:</strong> ${data.time_remaining || '-'}</p>
                    <p><strong>Active Players:</strong> ${data.active_players || 0}</p>
                `;
            });
    }
}

// Update admin dashboard every 5 seconds if on admin page
if (document.getElementById('currentRoundStatus')) {
    setInterval(updateAdminDashboard, 5000);
}
document.getElementById('playerSearch').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.player-row').forEach(row => {
        const playerName = row.getAttribute('data-player-name');
        row.style.display = playerName.includes(searchTerm) ? '' : 'none';
    });
});

window.clearSearch = function() {
    document.getElementById('playerSearch').value = '';
    document.querySelectorAll('.player-row').forEach(row => {
        row.style.display = '';
    });
};
