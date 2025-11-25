document.addEventListener('DOMContentLoaded', () => {
    // Check auth and update navigation links
    checkAuthAndUpdateLinks();

    // Theme Toggle with Dropdown
    const themeToggle = document.getElementById('themeToggle');
    const themeMenu = document.getElementById('themeMenu');
    const themeWrapper = themeToggle?.closest('.theme-toggle-wrapper');
    const themeOptions = document.querySelectorAll('.theme-option');
    const html = document.documentElement;
    const STORAGE_KEY = 'beamshare-theme';

    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    const resolveTheme = (mode) => mode === 'system' ? getSystemTheme() : mode;

    const getThemeLabel = (mode) => {
        const labels = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' };
        return labels[mode] || 'Sáng';
    };

    const getThemeIcon = (mode) => {
        const icons = { light: 'fa-sun', dark: 'fa-moon', system: 'fa-desktop' };
        return icons[mode] || 'fa-sun';
    };

    const updateToggleUI = (mode) => {
        const icon = themeToggle?.querySelector('.theme-toggle__icon');
        const label = themeToggle?.querySelector('.theme-toggle__label');
        
        if (icon) {
            icon.className = `fas ${getThemeIcon(mode)} theme-toggle__icon`;
        }
        if (label) {
            label.textContent = getThemeLabel(mode);
        }

        // Update active state on options
        themeOptions.forEach(opt => {
            const optTheme = opt.getAttribute('data-theme');
            opt.classList.toggle('is-active', optTheme === mode);
            opt.setAttribute('aria-checked', optTheme === mode ? 'true' : 'false');
        });
    };

    const setTheme = (mode, persist = true) => {
        const effective = resolveTheme(mode);
        
        // Add transition class for smooth animation
        document.body.classList.add('theme-transitioning');
        
        html.setAttribute('data-theme', effective);
        html.setAttribute('data-theme-mode', mode);
        
        if (persist) {
            localStorage.setItem(STORAGE_KEY, mode);
        }
        
        updateToggleUI(mode);
        
        // Remove transition class after animation completes
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);
    };

    const initTheme = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const initial = stored || 'system';
        setTheme(initial, Boolean(stored));

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const currentMode = html.getAttribute('data-theme-mode') || 'system';
            if (currentMode === 'system') {
                setTheme('system', false);
            }
        });
    };

    const openMenu = () => {
        themeWrapper?.classList.add('is-open');
        themeToggle?.setAttribute('aria-expanded', 'true');
    };

    const closeMenu = () => {
        themeWrapper?.classList.remove('is-open');
        themeToggle?.setAttribute('aria-expanded', 'false');
    };

    const toggleMenu = () => {
        if (themeWrapper?.classList.contains('is-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    initTheme();

    // Toggle menu on button click
    themeToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Handle theme option clicks
    themeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = option.getAttribute('data-theme');
            if (theme) {
                setTheme(theme);
                closeMenu();
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!themeWrapper?.contains(e.target)) {
            closeMenu();
        }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });

    // Mobile Menu
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');

    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileToggle.classList.toggle('active');
        
        // Animate hamburger
        const spans = mobileToggle.querySelectorAll('span');
        if (navMenu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
            const spans = mobileToggle.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        });
    });

    // Header Scroll Effect
    const header = document.querySelector('.site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });

            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Intersection Observer for Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Add animation classes to elements
    const animatedElements = [
        '.hero-content', 
        '.hero-visual', 
        '.feature-card', 
        '.pricing-card',
        '.live-content',
        '.live-visual',
        '.faq-item'
    ];

    animatedElements.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = `all 0.6s ease ${index * 0.1}s`;
            observer.observe(el);
        });
    });
});

// Function to check authentication and update navigation links
async function checkAuthAndUpdateLinks() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            const user = data?.user || data;
            if (user && (user.id || user._id)) {
                updateNavForLoggedInUser(user);
            }
        }
    } catch (error) {
        // User not logged in, keep default links
        console.log('User not authenticated');
    }
}

// Update navigation for logged in user
function updateNavForLoggedInUser(user) {
    const navActions = document.querySelector('.nav-actions');
    const loginBtn = navActions?.querySelector('a[href="/auth/login"]');
    const registerBtn = navActions?.querySelector('a[href="/auth/register"]');

    // Update login button to go to dashboard
    if (loginBtn) {
        loginBtn.href = '/dashboard';
        loginBtn.textContent = 'Dashboard';
    }

    // Update register button to show user info or go to dashboard
    if (registerBtn) {
        registerBtn.href = '/dashboard';
        registerBtn.innerHTML = '<i class="fa-solid fa-user"></i> ' + (user.fullName || user.email || 'Tài khoản');
    }

    // Update hero buttons
    const heroRegisterBtn = document.querySelector('.hero-btns a[href="/auth/register"]');
    if (heroRegisterBtn) {
        heroRegisterBtn.href = '/dashboard';
        heroRegisterBtn.innerHTML = 'Đi đến Dashboard <i class="fa-solid fa-arrow-right"></i>';
    }
}
