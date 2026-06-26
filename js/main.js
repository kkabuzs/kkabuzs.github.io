(function () {
  'use strict';

  // ---- Theme mode: manual override persists until the system theme changes ----
  var toggle = document.querySelector('.theme-toggle');
  var colorSchemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  applyTheme(getInitialTheme());
  clearLegacyThemeMode();

  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme') || getSystemTheme();
      var next = current === 'dark' ? 'light' : 'dark';
      setThemeOverride(next);
      applyTheme(next);
    });
  }

  if (colorSchemeQuery) {
    var onSystemThemeChange = function () {
      clearThemeOverride();
      applyTheme(getSystemTheme());
    };

    if (colorSchemeQuery.addEventListener) {
      colorSchemeQuery.addEventListener('change', onSystemThemeChange);
    } else if (colorSchemeQuery.addListener) {
      colorSchemeQuery.addListener(onSystemThemeChange);
    }
  }

  // ---- Mobile nav menu ----
  var navToggle = document.querySelector('.nav-toggle');
  var navMenu = document.querySelector('.nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        document.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---- Highlight active nav link ----
  var path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    if (href === '/' || href === '') {
      if (path === '/' || path === '/index.html') link.classList.add('is-active');
    } else if (path.indexOf(href) === 0) {
      link.classList.add('is-active');
    }
  });

  removeDuplicateMotto();
  setupArchiveExpansion();
  setupMobileToc();

  // ---- Copy button for code blocks ----
  document.querySelectorAll('figure.highlight, pre').forEach(function (block) {
    // Avoid duplicate buttons on nested pre inside figure
    if (block.tagName === 'PRE' && block.closest('figure.highlight')) return;
    if (block.dataset.codeReady === 'true') return;
    if (block.tagName === 'PRE' && isTextPre(block)) {
      block.classList.add('text-pre');
      block.dataset.codeReady = 'true';
      return;
    }

    var container = prepareCodeBlock(block);
    var toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';

    var lang = getCodeLanguage(block);
    if (lang) {
      var label = document.createElement('span');
      label.className = 'code-lang';
      label.textContent = lang;
      toolbar.appendChild(label);
    }

    var btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.type = 'button';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制代码');
    toolbar.appendChild(btn);

    container.classList.add('has-copy');
    container.appendChild(toolbar);
    block.dataset.codeReady = 'true';

    btn.addEventListener('click', function () {
      var codeEl = block.querySelector('td.code') || block.querySelector('code') || block;
      var text = codeEl.innerText.replace(/\n复制$/, '');
      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('is-copied');
        setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('is-copied');
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    });
  });

  function isTextPre(block) {
    if (block.classList && (block.classList.contains('hljs') || block.classList.contains('highlight'))) {
      return false;
    }

    var code = block.querySelector('code');
    if (!code) return true;

    var className = [block.className || '', code.className || ''].join(' ');
    if (/\b(?:hljs|language-|lang-)\S*/.test(className)) return false;
    return !getCodeLanguage(block);
  }

  function prepareCodeBlock(block) {
    if (block.tagName === 'FIGURE') {
      var scroll = block.querySelector(':scope > .code-scroll');
      if (!scroll) {
        scroll = document.createElement('div');
        scroll.className = 'code-scroll';
        while (block.firstChild) {
          scroll.appendChild(block.firstChild);
        }
        block.appendChild(scroll);
      }
      return block;
    }

    var wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    var preParent = block.parentNode;
    preParent.insertBefore(wrapper, block);
    var preScroll = document.createElement('div');
    preScroll.className = 'code-scroll';
    wrapper.appendChild(preScroll);
    preScroll.appendChild(block);
    return wrapper;
  }

  function getCodeLanguage(block) {
    var ignored = {
      highlight: true,
      hasCopy: true,
      'has-copy': true,
      code: true,
      hljs: true
    };
    var candidates = [
      'bash', 'sh', 'shell', 'zsh', 'json', 'yaml', 'yml', 'python', 'py',
      'javascript', 'js', 'typescript', 'ts', 'html', 'css', 'nginx',
      'dockerfile', 'sql', 'java', 'go', 'rust', 'markdown', 'md'
    ];

    for (var i = 0; i < candidates.length; i++) {
      if (block.classList && block.classList.contains(candidates[i])) {
        return normalizeLanguage(candidates[i]);
      }
    }

    var code = block.querySelector('code');
    if (code && code.className) {
      var classes = String(code.className).split(/\s+/);
      for (var j = 0; j < classes.length; j++) {
        var cls = classes[j].replace(/^language-/, '').replace(/^lang-/, '');
        if (!ignored[cls]) return normalizeLanguage(cls);
      }
    }
    return '';
  }

  function normalizeLanguage(lang) {
    var map = {
      sh: 'bash',
      shell: 'bash',
      zsh: 'bash',
      py: 'python',
      js: 'javascript',
      ts: 'typescript',
      yml: 'yaml',
      md: 'markdown'
    };
    return map[lang] || lang;
  }

  function getSystemTheme() {
    return colorSchemeQuery && colorSchemeQuery.matches ? 'dark' : 'light';
  }

  function getInitialTheme() {
    return getThemeOverride() || getSystemTheme();
  }

  function getThemeOverride() {
    try {
      var override = localStorage.getItem('theme-override');
      return override === 'light' || override === 'dark' ? override : '';
    } catch (e) {
      return '';
    }
  }

  function setThemeOverride(theme) {
    try {
      localStorage.setItem('theme-override', theme);
      localStorage.removeItem('theme-mode');
      localStorage.removeItem('theme');
    } catch (e) {}
  }

  function clearThemeOverride() {
    try {
      localStorage.removeItem('theme-override');
    } catch (e) {}
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeMeta(theme);
    updateThemeToggle(theme);
  }

  function clearLegacyThemeMode() {
    try {
      localStorage.removeItem('theme-mode');
      localStorage.removeItem('theme');
    } catch (e) {}
  }

  function updateThemeMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1c1c1e' : '#ffffff');
  }

  function updateThemeToggle(theme) {
    if (!toggle) return;

    var label = theme === 'dark' ? '深色模式，点击切换浅色' : '浅色模式，点击切换深色';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  function removeDuplicateMotto() {
    var motto = document.querySelector('.post-motto');
    var content = document.querySelector('.post-content');
    if (!motto || !content) return;

    var first = content.firstElementChild;
    if (!first || first.tagName !== 'BLOCKQUOTE') return;

    var mottoText = normalizeComparableText(motto.getAttribute('data-motto-text') || motto.textContent);
    var quoteText = normalizeComparableText(first.textContent);
    if (mottoText && quoteText.indexOf(mottoText) !== -1) {
      first.remove();
    }
  }

  function normalizeComparableText(value) {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  }

  function setupArchiveExpansion() {
    var years = document.querySelectorAll('details.archive-year');
    if (!years.length) return;

    years.forEach(function (year) {
      year.addEventListener('toggle', function () {
        if (year.open) openArchiveMonths(year);
      });
    });

    document.querySelectorAll('.archive-year-pill').forEach(function (link) {
      link.addEventListener('click', function () {
        var id = decodeURIComponent((link.getAttribute('href') || '').replace('#', ''));
        if (!id) return;
        var year = document.getElementById(id);
        if (!year) return;
        year.open = true;
        openArchiveMonths(year);
      });
    });
  }

  function openArchiveMonths(year) {
    year.querySelectorAll('details.archive-month').forEach(function (month) {
      month.open = true;
    });
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      cb();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---- Active TOC highlight on scroll ----
  var tocLinks = document.querySelectorAll('.post-toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var map = {};
    tocLinks.forEach(function (a) {
      var id = decodeURIComponent((a.getAttribute('href') || '').replace('#', ''));
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(a);
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var links = map[entry.target.id];
        if (!links) return;
        if (entry.isIntersecting) {
          tocLinks.forEach(function (l) { l.classList.remove('is-active'); });
          links.forEach(function (link) { link.classList.add('is-active'); });
          scrollActiveTocIntoView(document.querySelector('.toc-widget'));
        }
      });
    }, { rootMargin: '0px 0px -75% 0px' });

    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  function scrollActiveTocIntoView(container) {
    if (!container || container.scrollHeight <= container.clientHeight) return;
    var link = container.querySelector('.toc-link.is-active');
    if (!link) return;
    var cRect = container.getBoundingClientRect();
    var lRect = link.getBoundingClientRect();
    if (lRect.top >= cRect.top && lRect.bottom <= cRect.bottom) return;
    var delta = (lRect.top + lRect.height / 2) - (cRect.top + cRect.height / 2);
    container.scrollTop += delta;
  }

  function setupMobileToc() {
    var tocToggle = document.querySelector('.mobile-toc-toggle');
    var tocOverlay = document.querySelector('.mobile-toc-overlay');
    var tocClose = document.querySelector('.mobile-toc-close');
    if (!tocToggle || !tocOverlay) return;

    var openToc = function () {
      document.body.classList.add('mobile-toc-open');
      tocToggle.setAttribute('aria-expanded', 'true');
      tocOverlay.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () {
        scrollActiveTocIntoView(document.querySelector('.mobile-post-toc'));
      });
    };

    var closeToc = function () {
      document.body.classList.remove('mobile-toc-open');
      tocToggle.setAttribute('aria-expanded', 'false');
      tocOverlay.setAttribute('aria-hidden', 'true');
    };

    tocToggle.addEventListener('click', openToc);
    if (tocClose) tocClose.addEventListener('click', closeToc);
    tocOverlay.addEventListener('click', function (event) {
      if (event.target === tocOverlay) closeToc();
    });
    tocOverlay.querySelectorAll('.toc-link').forEach(function (link) {
      link.addEventListener('click', closeToc);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeToc();
    });
  }

  // ---- Context-aware site search ----
  var searchToggle = document.querySelector('.search-toggle');
  var searchOverlay = document.querySelector('.search-overlay');
  var searchClose = document.querySelector('.search-close');
  var searchInput = document.querySelector('.search-input');
  var searchScope = document.querySelector('.search-scope');
  var searchResults = document.querySelector('.search-results');
  var searchDataPromise = null;
  var searchData = [];
  var searchContext = getSearchContext();

  if (searchScope) searchScope.textContent = searchContext.label;
  if (searchInput) searchInput.setAttribute('placeholder', searchContext.placeholder);

  if (searchToggle && searchOverlay && searchInput) {
    searchToggle.addEventListener('click', openSearch);
  }
  if (searchClose) searchClose.addEventListener('click', closeSearch);
  if (searchOverlay) {
    searchOverlay.addEventListener('click', function (event) {
      if (event.target === searchOverlay) closeSearch();
    });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeSearch();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
  });
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      renderSearchResults(searchInput.value);
    });
  }

  function openSearch() {
    document.body.classList.add('search-open');
    searchOverlay.setAttribute('aria-hidden', 'false');
    loadSearchData().then(function () {
      renderSearchResults(searchInput.value);
      searchInput.focus();
    }).catch(function () {
      searchResults.innerHTML = '<div class="search-empty">搜索索引加载失败</div>';
    });
  }

  function closeSearch() {
    if (!searchOverlay) return;
    document.body.classList.remove('search-open');
    searchOverlay.setAttribute('aria-hidden', 'true');
  }

  function loadSearchData() {
    if (searchDataPromise) return searchDataPromise;
    searchDataPromise = fetch('/kk-search.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Search index not found');
        return response.json();
      })
      .then(function (data) {
        searchData = Array.isArray(data) ? data : [];
        return searchData;
      });
    return searchDataPromise;
  }

  function renderSearchResults(rawQuery) {
    if (!searchResults) return;
    var query = normalizeText(rawQuery);

    if (searchContext.type === 'category-index' || searchContext.type === 'tag-index') {
      renderTaxonomySearch(query);
      return;
    }

    if (!query) {
      searchResults.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
      return;
    }

    var scoped = filterByContext(searchData, searchContext);
    var terms = query.split(/\s+/).filter(Boolean);
    var results = scoped.map(function (item) {
      return {
        item: item,
        score: scorePost(item, terms)
      };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    }).slice(0, 12);

    if (!results.length) {
      searchResults.innerHTML = '<div class="search-empty">没有找到匹配结果</div>';
      return;
    }

    searchResults.innerHTML = results.map(function (entry) {
      return renderPostResult(entry.item, terms);
    }).join('');
  }

  function renderTaxonomySearch(query) {
    var type = searchContext.type === 'category-index' ? 'categories' : 'tags';
    var map = {};

    searchData.forEach(function (post) {
      (post[type] || []).forEach(function (item) {
        if (!map[item.url]) {
          map[item.url] = {
            name: item.name,
            url: item.url,
            count: 0
          };
        }
        map[item.url].count += 1;
      });
    });

    var list = Object.keys(map).map(function (url) {
      return map[url];
    }).sort(function (a, b) {
      return b.count - a.count;
    }).filter(function (item) {
      if (!query) return true;
      return normalizeText(item.name).indexOf(query) !== -1;
    }).slice(0, 24);

    if (!list.length) {
      searchResults.innerHTML = '<div class="search-empty">没有找到匹配结果</div>';
      return;
    }

    searchResults.innerHTML = list.map(function (item) {
      return '<a class="search-result taxonomy-result" href="' + escapeAttr(item.url) + '">' +
        '<span class="search-title">' + escapeHtml(item.name) + '</span>' +
        '<span class="search-meta">' + item.count + ' 篇</span>' +
        '</a>';
    }).join('');
  }

  function filterByContext(items, context) {
    if (context.type === 'category') {
      return items.filter(function (item) {
        return hasTaxonomy(item.categories, context.urlPrefix);
      });
    }
    if (context.type === 'tag') {
      return items.filter(function (item) {
        return hasTaxonomy(item.tags, context.urlPrefix);
      });
    }
    return items;
  }

  function hasTaxonomy(list, urlPrefix) {
    return (list || []).some(function (item) {
      return normalizePath(item.url) === urlPrefix;
    });
  }

  function scorePost(item, terms) {
    var title = normalizeText(item.title);
    var content = normalizeText(item.content);
    var categories = normalizeText((item.categories || []).map(function (cat) { return cat.name; }).join(' '));
    var tags = normalizeText((item.tags || []).map(function (tag) { return tag.name; }).join(' '));
    var score = 0;

    terms.forEach(function (term) {
      if (title.indexOf(term) !== -1) score += 8;
      if (categories.indexOf(term) !== -1) score += 4;
      if (tags.indexOf(term) !== -1) score += 4;
      if (content.indexOf(term) !== -1) score += 1;
    });

    return score;
  }

  function renderPostResult(item, terms) {
    var meta = [];
    if (item.date) meta.push(item.date);
    if (item.categories && item.categories.length) {
      meta.push(item.categories.map(function (cat) { return cat.name; }).join(' / '));
    }
    var excerpt = makeExcerpt(item.content, terms);

    return '<a class="search-result" href="' + escapeAttr(item.url) + '">' +
      '<span class="search-title">' + highlightText(item.title, terms) + '</span>' +
      '<span class="search-meta">' + escapeHtml(meta.join(' · ')) + '</span>' +
      (excerpt ? '<span class="search-excerpt">' + highlightText(excerpt, terms) + '</span>' : '') +
      '</a>';
  }

  function makeExcerpt(content, terms) {
    var text = String(content || '');
    var lower = normalizeText(text);
    var index = -1;
    terms.some(function (term) {
      index = lower.indexOf(term);
      return index !== -1;
    });

    if (index === -1) return text.slice(0, 110);
    var start = Math.max(index - 36, 0);
    var end = Math.min(index + 100, text.length);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  }

  function highlightText(text, terms) {
    var escaped = escapeHtml(text);
    terms.forEach(function (term) {
      if (!term) return;
      var re = new RegExp(escapeRegExp(escapeHtml(term)), 'ig');
      escaped = escaped.replace(re, '<mark>$&</mark>');
    });
    return escaped;
  }

  function getSearchContext() {
    var path = normalizePath(window.location.pathname);
    if (path === '/categories/') {
      return {
        type: 'category-index',
        label: '搜索分类',
        placeholder: '搜索分类...'
      };
    }
    if (path.indexOf('/categories/') === 0) {
      return {
        type: 'category',
        urlPrefix: path,
        label: '搜索当前分类文章',
        placeholder: '搜索当前分类文章...'
      };
    }
    if (path === '/tags/') {
      return {
        type: 'tag-index',
        label: '搜索标签',
        placeholder: '搜索标签...'
      };
    }
    if (path.indexOf('/tags/') === 0) {
      return {
        type: 'tag',
        urlPrefix: path,
        label: '搜索当前标签文章',
        placeholder: '搜索当前标签文章...'
      };
    }
    if (path.indexOf('/archives/') === 0) {
      return {
        type: 'all',
        label: '搜索全部文章',
        placeholder: '搜索全部文章...'
      };
    }
    return {
      type: 'all',
      label: '搜索全部文章',
      placeholder: '搜索全部文章...'
    };
  }

  function normalizePath(path) {
    var value = decodeURIComponent(path || '/');
    if (!value.startsWith('/')) value = '/' + value;
    if (!value.endsWith('/')) value += '/';
    return value.replace(/\/{2,}/g, '/');
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().trim();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
