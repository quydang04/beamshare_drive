// Subscription Page JavaScript
window.initSubscription = function() {
    // Handle subscription buttons
    const subscribeButtons = document.querySelectorAll('.btn-subscribe');
    subscribeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.pricing-card');
            const planName = card.querySelector('h3').textContent;
            
            handleSubscription(planName, this);
        });
    });
    
    // Update usage bar animation
    animateUsageBar();
    
    function handleSubscription(planName, button) {
        const originalText = button.textContent;
        button.textContent = 'Đang xử lý...';
        button.disabled = true;
        
        // Simulate subscription process
        setTimeout(() => {
            if (planName === 'Cơ Bản') {
                showNotification(`Bạn đã đăng ký gói ${planName} thành công!`);
            } else {
                showNotification(`Đang chuyển hướng đến trang thanh toán cho gói ${planName}...`);
                // In a real app, this would redirect to payment gateway
            }
            
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);
    }
    
    function animateUsageBar() {
        const usageProgress = document.querySelector('.usage-progress');
        if (usageProgress) {
            // Get the target width from style attribute
            const targetWidth = usageProgress.style.width;
            
            // Start from 0 and animate to target width
            usageProgress.style.width = '0%';

    window.cleanupSubscription = function cleanupSubscription() {
        // No persistent subscriptions to remove yet; placeholder for symmetry
    };
            setTimeout(() => {
                usageProgress.style.transition = 'width 1.5s ease-out';
                usageProgress.style.width = targetWidth;
            }, 500);
        }
    }
    
    console.log('Subscription page initialized');
};

// Auto-initialize if page is already loaded
document.addEventListener('DOMContentLoaded', function() {
    const subscriptionPage = document.getElementById('subscription-page');
    if (subscriptionPage && subscriptionPage.classList.contains('active')) {
        window.initSubscription();
    }
});