// BeamShare Enhanced UI Effects

// Create floating particles
function createFloatingParticles() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'floating-particles';
    document.body.appendChild(particleContainer);
    
    // Create particles
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            createParticle(particleContainer);
        }, i * 500);
    }
    
    // Continue creating particles
    setInterval(() => {
        if (particleContainer.children.length < 15) {
            createParticle(particleContainer);
        }
    }, 2000);
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random horizontal position
    particle.style.left = Math.random() * 100 + '%';
    
    // Random animation duration
    particle.style.animationDuration = (Math.random() * 3 + 5) + 's';
    
    // Random delay
    particle.style.animationDelay = Math.random() * 2 + 's';
    
    container.appendChild(particle);
    
    // Remove particle after animation
    setTimeout(() => {
        if (particle.parentNode) {
            particle.parentNode.removeChild(particle);
        }
    }, 8000);
}

// Enhanced peer card interactions
function enhancePeerCards() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'X-PEER') {
                        enhancePeerCard(node);
                    }
                });
            }
        });
    });
    
    // Observe the peers container
    const peersContainer = document.querySelector('x-peers');
    if (peersContainer) {
        observer.observe(peersContainer, { childList: true });
        
        // Enhance existing peer cards
        peersContainer.querySelectorAll('x-peer').forEach(enhancePeerCard);
    }
}

function enhancePeerCard(peerCard) {
    // Don't add glass-panel class to avoid white background
    // peerCard.classList.add('glass-panel');
    
    // Add ripple effect on click
    peerCard.addEventListener('click', function(e) {
        createRipple(e, this);
    });
    
    // Add hover sound effect (optional)
    peerCard.addEventListener('mouseenter', function() {
        // Play a subtle hover sound if available
        if (typeof playHoverSound === 'function') {
            playHoverSound();
        }
    });
}

function createRipple(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Enhanced upload area
function enhanceUploadArea() {
    const center = document.getElementById('center');
    if (center) {
        center.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-active');
        });
        
        center.addEventListener('dragleave', function(e) {
            if (!this.contains(e.relatedTarget)) {
                this.classList.remove('drag-active');
            }
        });
        
        center.addEventListener('drop', function(e) {
            this.classList.remove('drag-active');
        });
    }
}

// Connection status indicator
function addConnectionStatus() {
    const footer = document.querySelector('footer');
    if (footer) {
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'connection-status';
        statusIndicator.innerHTML = `
            <div class="connection-dot"></div>
            <span>Đã kết nối</span>
        `;
        
        footer.insertBefore(statusIndicator, footer.firstChild);
    }
}

// Smooth scroll for better UX
function addSmoothScrolling() {
    document.documentElement.style.scrollBehavior = 'smooth';
}

// Loading animation for file transfers
function showTransferProgress(progress) {
    const progressRing = document.querySelector('.progress-ring circle');
    if (progressRing) {
        const circumference = 2 * Math.PI * 30; // radius = 30
        progressRing.style.strokeDasharray = circumference;
        progressRing.style.strokeDashoffset = circumference - (progress / 100) * circumference;
    }
}

// Theme color animation
function animateThemeColors() {
    const root = document.documentElement;
    let hue = 0;
    
    setInterval(() => {
        hue = (hue + 1) % 360;
        const primaryColor = `hsl(${hue}, 70%, 55%)`;
        const secondaryColor = `hsl(${(hue + 120) % 360}, 70%, 55%)`;
        
        // Only animate if user hasn't interacted recently
        if (document.hidden || !document.hasFocus()) {
            root.style.setProperty('--primary-color', primaryColor);
            root.style.setProperty('--secondary-color', secondaryColor);
        }
    }, 100);
}

// About Modal Functions
function initAboutModal() {
    const aboutBtn = document.querySelector('a[href="#about"]');
    const aboutModal = document.getElementById('about-modal');
    const closeAboutBtn = document.querySelector('.close-about-btn');
    
    if (aboutBtn && aboutModal) {
        aboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAboutModal();
        });
    }
    
    if (closeAboutBtn) {
        closeAboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideAboutModal();
        });
    }
    
    // Close on background click
    if (aboutModal) {
        aboutModal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideAboutModal();
            }
        });
    }
}

function showAboutModal() {
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.setAttribute('show', '');
        document.body.style.overflow = 'hidden';
    }
}

function hideAboutModal() {
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
        aboutModal.removeAttribute('show');
        document.body.style.overflow = '';
    }
}

// Initialize enhanced UI when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add a small delay to ensure all elements are loaded
    setTimeout(() => {
        // createFloatingParticles();
        enhancePeerCards();
        enhanceUploadArea();
        addConnectionStatus();
        addSmoothScrolling();
        initAboutModal();
        initLanguageDialog();
        
        // Add CSS for ripple effect
        const style = document.createElement('style');
        style.textContent = `
            .ripple-effect {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple-animation 0.6s linear;
                pointer-events: none;
            }
            
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            .drag-active {
                background: rgba(231, 76, 60, 0.1) !important;
                border: 2px dashed var(--primary-color) !important;
                transform: scale(1.02);
            }
            
            x-peer.glass-panel {
                backdrop-filter: blur(15px);
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .connection-status {
                margin-bottom: 10px;
                font-size: 12px;
                font-weight: 500;
                background: rgba(var(--bg-color), 0.9) !important;
                border: 2px solid var(--border-color) !important;
                color: rgb(var(--text-color)) !important;
            }
            
            /* Light theme connection status */
            body.light-theme .connection-status,
            body:not(.dark-theme) .connection-status {
                background: rgba(255, 255, 255, 0.9) !important;
                border: 2px solid rgba(0,0,0,0.1) !important;
                color: rgba(0,0,0,0.8) !important;
            }
            
            /* Dark theme connection status */
            body.dark-theme .connection-status {
                background: rgba(0, 0, 0, 0.8) !important;
                border: 2px solid rgba(255,255,255,0.2) !important;
                color: rgba(255,255,255,0.9) !important;
            }
            
            /* Focus improvements for accessibility */
            .btn:focus,
            .icon-button:focus {
                outline: 2px solid var(--primary-color);
                outline-offset: 2px;
            }
            
            /* Better mobile touch targets */
            @media (max-width: 768px) {
                .icon-button {
                    min-width: 48px;
                    min-height: 48px;
                }
                
                .btn {
                    min-height: 44px;
                    padding: 8px 16px;
                }
            }
        `;
        document.head.appendChild(style);
        
    }, 500);
});

// Optional: Add keyboard shortcuts for power users
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K for quick actions
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Show quick actions menu
        showQuickActions();
    }
    
    // Escape to close dialogs
    if (e.key === 'Escape') {
        const aboutModal = document.getElementById('about-modal');
        if (aboutModal && aboutModal.hasAttribute('show')) {
            hideAboutModal();
            return;
        }
        
        const languageDialog = document.getElementById('language-select-dialog');
        if (languageDialog && languageDialog.hasAttribute('show')) {
            closeLanguageDialog();
            return;
        }
        
        const openDialog = document.querySelector('x-dialog[show]');
        if (openDialog) {
            openDialog.removeAttribute('show');
        }
    }
});

function showQuickActions() {
    // Implementation for quick actions menu
    console.log('Quick actions menu - to be implemented');
}

// Language Dialog Functions
function showLanguageDialog() {
    const languageDialog = document.getElementById('language-select-dialog');
    if (languageDialog) {
        // Highlight current language
        const languageButtons = languageDialog.querySelectorAll('.language-buttons .btn');
        languageButtons.forEach(btn => btn.classList.remove('current'));

        if (typeof Localization !== 'undefined') {
            if (Localization.isSystemLocale()) {
                const systemBtn = languageDialog.querySelector('.language-buttons .btn[value=""]');
                if (systemBtn) systemBtn.classList.add('current');
            } else {
                const currentLocale = Localization.getLocale();
                const currentBtn = languageDialog.querySelector(`.language-buttons .btn[value="${currentLocale}"]`);
                if (currentBtn) currentBtn.classList.add('current');
            }
        }

        languageDialog.setAttribute('show', '');
        document.body.style.overflow = 'hidden';
    }
}

function closeLanguageDialog() {
    const languageDialog = document.getElementById('language-select-dialog');
    if (languageDialog) {
        languageDialog.removeAttribute('show');
        document.body.style.overflow = '';
    }
}

function setLanguage(langCode) {
    // Use the same logic as the original LanguageSelectDialog
    if (langCode) {
        localStorage.setItem('language_code', langCode);
    } else {
        localStorage.removeItem('language_code');
    }

    // Use Localization.setTranslation if available
    if (typeof Localization !== 'undefined' && Localization.setTranslation) {
        Localization.setTranslation(langCode)
            .then(_ => closeLanguageDialog());
    } else {
        // Fallback: reload page
        location.reload();
    }
}

function initLanguageDialog() {
    // Find the language selector button and add click handler
    const languageBtn = document.getElementById('language-selector');
    if (languageBtn) {
        languageBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showLanguageDialog();
        });
    }
    
    // Add escape key handler for language dialog
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const languageDialog = document.getElementById('language-select-dialog');
            if (languageDialog && languageDialog.hasAttribute('show')) {
                closeLanguageDialog();
            }
        }
    });
}

// Export functions for use in other scripts
window.BeamShareUI = {
    createRipple,
    showTransferProgress,
    enhancePeerCard,
    showAboutModal,
    hideAboutModal,
    showLanguageDialog,
    closeLanguageDialog,
    setLanguage
};
