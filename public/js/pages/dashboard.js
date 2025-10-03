// Dashboard Page JavaScript
window.initDashboard = function() {
    // Tab functionality for dashboard
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Handle tab content switching if needed
            const tabName = this.textContent.trim();
            handleTabSwitch(tabName);
        });
    });
    
    // Upload new button functionality
    const btnUploadNew = document.querySelector('.btn-upload-new');
    if (btnUploadNew) {
        btnUploadNew.addEventListener('click', function() {
            window.switchToPage('upload');
        });
    }
    
    // Initialize dashboard stats
    updateDashboardStats();
    
    function handleTabSwitch(tabName) {
        switch(tabName) {
            case 'Tổng quan':
                console.log('Switching to overview tab');
                break;
            case 'Tệp của tôi':
                console.log('Switching to files tab');
                break;
            case 'Phân tích':
                console.log('Switching to analytics tab');
                break;
        }
    }
    
    function updateDashboardStats() {
        // This would typically fetch data from server
        // For now, we'll use static data
        const stats = {
            totalFiles: 0,
            dataUsed: '0.00 MB',
            downloadsOther: 0
        };
        
        // Update stat values
        const statValues = document.querySelectorAll('.stat-value');
        if (statValues.length >= 3) {
            statValues[0].textContent = stats.totalFiles;
            statValues[1].textContent = stats.dataUsed;
            statValues[2].textContent = stats.downloadsOther;
        }
    }
    
    console.log('Dashboard page initialized');
};

// Auto-initialize if page is already loaded
document.addEventListener('DOMContentLoaded', function() {
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage && dashboardPage.classList.contains('active')) {
        window.initDashboard();
    }
});