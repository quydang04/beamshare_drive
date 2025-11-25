document.addEventListener('DOMContentLoaded', () => {
    // Check auth and update navigation links
    checkAuthAndUpdateLinks();

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    const STORAGE_KEY = 'beamshare-theme';

    const setTheme = (theme) => {
        html.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
    };

    const initTheme = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setTheme(stored);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
        }
    };

    initTheme();

    themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
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
