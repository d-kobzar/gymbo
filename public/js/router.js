/* Hash-based SPA router */
const Router = {
  pages: {},
  currentPage: null,
  container: null,
  tabBar: null,

  // Pages reachable from "More" menu (no tab, show back)
  subPages: ['program', 'measurements', 'exercises', 'settings'],

  init() {
    this.container = document.getElementById('page-container');
    this.tabBar = document.getElementById('tab-bar');

    window.addEventListener('hashchange', () => this.onHashChange());

    // Initial route
    this.onHashChange();
  },

  onHashChange() {
    const hash = location.hash.replace('#', '') || 'home';
    this.navigate(hash);
  },

  async navigate(page) {
    if (this.currentPage === page) return;

    // Fetch page HTML if not cached
    if (!this.pages[page]) {
      try {
        const res = await fetch(`/pages/${page}.html`);
        if (!res.ok) {
          // Fallback to home if page not found
          if (page !== 'home') {
            location.hash = '#home';
            return;
          }
          this.container.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-state-text">Page not found</div></div></div>';
          return;
        }
        this.pages[page] = await res.text();
      } catch (e) {
        console.error('Failed to load page:', page, e);
        return;
      }
    }

    // Inject content with animation
    this.container.style.animation = 'none';
    this.container.offsetHeight; // trigger reflow
    this.container.style.animation = '';
    this.container.innerHTML = this.pages[page];

    this.currentPage = page;

    // Update tab bar active state
    this.updateTabs(page);

    // Apply translations
    I18n.apply(this.container);

    // Telegram back button
    if (this.subPages.includes(page)) {
      TG.setupBackButton(() => {
        history.back();
      });
    } else {
      TG.setupBackButton(null);
    }

    // Call page init if registered
    if (window.PageInit && window.PageInit[page]) {
      try {
        await window.PageInit[page]();
      } catch (e) {
        console.error('Page init error:', page, e);
      }
    }

    // Scroll to top
    window.scrollTo(0, 0);
  },

  updateTabs(page) {
    const tabs = this.tabBar.querySelectorAll('.tab');
    // If it's a sub-page, highlight "More" tab
    const activePage = this.subPages.includes(page) ? 'more' : page;
    tabs.forEach(tab => {
      const tabPage = tab.getAttribute('data-page');
      tab.classList.toggle('active', tabPage === activePage);
    });
  },

  back() {
    if (history.length > 1) {
      history.back();
    } else {
      location.hash = '#home';
    }
  }
};
