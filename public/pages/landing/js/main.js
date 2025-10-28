const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const STORAGE_KEY = 'beamshare-theme';

const root = document.documentElement;
const navToggle = document.getElementById('navToggle');
const primaryNav = document.getElementById('primaryNav');
const themeToggle = document.getElementById('themeToggle');
const currentYear = document.getElementById('currentYear');
const navBar = document.querySelector('.nav');

const setTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
};

const initTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        setTheme(stored);
        return;
    }
    setTheme(prefersDark.matches ? 'dark' : 'light');
};

initTheme();

prefersDark.addEventListener('change', (event) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        setTheme(event.matches ? 'dark' : 'light');
    }
});

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });
}

if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
        const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', String(!isExpanded));
        primaryNav.classList.toggle('is-open');
        if (!isExpanded) {
            navBar?.classList.add('nav--scrolled');
        } else {
            requestAnimationFrame(() => updateHeaderState());
        }
    });

    primaryNav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navToggle.setAttribute('aria-expanded', 'false');
            primaryNav.classList.remove('is-open');
            requestAnimationFrame(() => updateHeaderState());
        });
    });
}

const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    },
    {
        threshold: 0.2,
    }
);

document.querySelectorAll('[data-observe]').forEach((element) => observer.observe(element));

const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach((item) => {
    const trigger = item.querySelector('.faq-item__trigger');
    const content = item.querySelector('.faq-item__content');
    if (!trigger || !content) return;

    trigger.addEventListener('click', () => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        item.setAttribute('aria-expanded', String(!expanded));
        content.style.maxHeight = expanded ? null : `${content.scrollHeight}px`;
        item.querySelector('.faq-item__icon').textContent = expanded ? '+' : '−';
    });
});

const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
smoothScrollLinks.forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
        const targetId = anchor.getAttribute('href');
        if (targetId.length <= 1) return;
        const target = document.querySelector(targetId);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && primaryNav) {
        primaryNav.classList.remove('is-open');
        navToggle?.setAttribute('aria-expanded', 'false');
    }
    updateHeaderState();
});

const updateHeaderState = () => {
    if (!navBar) return;
    const shouldStick = window.scrollY > 12 || primaryNav?.classList.contains('is-open');
    navBar.classList.toggle('nav--scrolled', !!shouldStick);
};

updateHeaderState();
window.addEventListener('scroll', updateHeaderState);
