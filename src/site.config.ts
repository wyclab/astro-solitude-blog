import { defineSolitudeConfig } from './lib/config';

export default defineSolitudeConfig({
  site: 'https://blog.wyclab.com',
  title: '望云川',
  description:
    '望云川，一个普通人的记录',
  locale: 'zh-CN',
  hasCJKLanguage: true,
  timeZone: 'Asia/Shanghai',
  author: { name: '望云川' },
  menus: [
    {
      name: '归档',
      children: [
        { name: '全部文章', url: '/archives/', icon: 'fas fa-folder-closed' },
        { name: '分类', url: '/categories/', icon: 'fas fa-clone' },
        { name: '标签', url: '/tags/', icon: 'fas fa-tags' },
      ],
    },
    { name: '友链', url: '/links/' },
    {
      name: '探索',
      children: [
        { name: '关于', url: '/about/' },
        { name: '项目', url: '/equipment/' },
        { name: '即刻', url: '/brevity/' },
      ],
    },
  ],
  theme: {
    lightbox: 'fancybox',
    // 评论系统：Twikoo
    comment: {
      use: 'twikoo',
    },
    twikoo: {
      envId: 'https://twikoo.wyclab.com',
    },
    nav: {
      group: {
        切换站点: [
          {
            name: '落地页',
            url: 'https://www.wyclab.com',
            icon: '/img/logo.png',
          },
        ],
      },
    },
    hometop: {
      banner: {
        title: 'Write and create with Solitude',
        desc: 'An Astro theme with guides, examples, and content components.',
      },
    },
    aside: {
      home: { noSticky: 'about', Sticky: 'allInfo' },
      post: { noSticky: '', Sticky: '' },
      page: { noSticky: 'about', Sticky: 'newestPost,allInfo' },
      tag: { noSticky: '', Sticky: 'allInfo' },
      my_card: {
        description: '望云川',
        content: '凭栏望云，渡川而行',
        witty_words: ['生活本不完美，幸甚有记录', 'Stay hungry, stay foolish'],
        information: [
          {
            name: 'GitHub',
            url: 'https://github.com/wyclab',
            icon: 'fab fa-github',
          },
        ],
      },
    },
    footer: {
      information: {
        left: [
          {
            name: 'GitHub',
            url: 'https://github.com/wyclab',
            icon: 'fab fa-github',
          },
        ],
        right: [{ name: 'RSS', url: '/index.xml', icon: 'fas fa-rss' }],
      },
      group: {
        归档: [
          { name: '全部文章', url: '/archives/' },
          { name: '分类', url: '/categories/' },
        ],
        关于: [
          { name: '博主', url: '/about/' },
          { name: '友链', url: '/links/' },
        ],
      },
    },
    // See docs/integrations.md to enable comments.
    post: {
      meta: { locate: false },
      covercolor: { enable: true, mode: 'local' },
    },
    brevity: { enable: true },
    keyboard: {
      enable: true,
      list: [
        { modifier: 'shift', key: 'D', action: 'toggleTheme' },
        { modifier: 'mod', key: 'F', action: 'openSearch' },
        { modifier: 'shift', key: 'K', action: 'toggleKeyboard' },
      ],
    },
    search: { tags: ['股票', '经济', '日记'], local: { preload: true } },
    pwa: { enable: true },
  },
});
