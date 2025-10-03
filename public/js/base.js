// Base JavaScript - Common functionality and navigation
document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation items and pages
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    // Handle navigation clicks
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Hide all pages
            pages.forEach(page => page.classList.remove('active'));
            
            // Show selected page
            const targetPage = this.getAttribute('data-page');
            const targetElement = document.getElementById(targetPage + '-page');
            if (targetElement) {
                targetElement.classList.add('active');
            }
            
            // Update user info based on page
            updateUserInfo(targetPage);
            
            // Load page-specific functionality
            loadPageFunctionality(targetPage);
        });
    });
    
    // Update user info function
    function updateUserInfo(page) {
        const userInitial = document.getElementById('user-initial');
        const userName = document.getElementById('user-name');
        
        // Set all users to "User" with initial "U"
        userInitial.textContent = 'U';
        userName.textContent = 'User';
        userInitial.parentElement.style.background = '#8b5cf6';
    }
    
    // Load page-specific functionality
    function loadPageFunctionality(page) {
        // This function is kept for compatibility but functionality
        // is now handled by the main index.html script
        switch(page) {
            case 'myfiles':
                if (window.initMyFiles) window.initMyFiles();
                break;
            case 'upload':
                if (window.initUpload) window.initUpload();
                break;
            case 'dashboard':
                if (window.initDashboard) window.initDashboard();
                break;
            case 'subscription':
                if (window.initSubscription) window.initSubscription();
                break;
        }
    }
    
    // Initialize with default page (My Files)
    updateUserInfo('myfiles');
    
    // Global functions
    window.updateUserInfo = updateUserInfo;
    window.switchToPage = function(pageName) {
        const navItem = document.querySelector(`[data-page="${pageName}"]`);
        if (navItem) {
            navItem.click();
        }
    };
});

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Show notification utility
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const backgroundColor = type === 'success' ? '#10b981' : '#ef4444';
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}