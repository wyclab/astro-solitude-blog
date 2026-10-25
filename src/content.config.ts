import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// 统一按北京时间解析日期：无时区的时间串（如 '2026-04-25 08:00'）固定补 +08:00；
// 已带时区 / 纯日期（YYYY-MM-DD，UTC）则原样解析，兼容旧写法。
const beijingDate = z.preprocess((val) => {
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val !== 'string') return val;
  const s = val.trim();
  if (!s) return val;
  let d: Date;
  if (/([+-]\d{2}:?\d{2}|Z)$/i.test(s)) d = new Date(s);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(s);
  else d = new Date(`${s.replace(' ', 'T')}+08:00`);
  return Number.isNaN(d.getTime()) ? val : d;
}, z.date());

const common = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    date: beijingDate.optional(),
    lastmod: beijingDate.optional(),
    slug: z.string().optional(),
    url: z.string().optional(),
    aliases: z.array(z.string()).default([]),
    cover: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    series: z.array(z.string()).default([]),
    home: z.boolean().default(true),
    draft: z.boolean().default(false),
    sticky: z.union([z.boolean(), z.number()]).default(false),
    comment: z.boolean().default(true),
    aside: z.boolean().default(true),
    toc: z.boolean().default(true),
    random: z.boolean().default(true),
    type: z.string().optional(),
    not_cover: z.boolean().optional(),
  })
  .passthrough();
export const collections = {
  posts: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
    schema: common.extend({ date: beijingDate }),
  }),
  pages: defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
    schema: common,
  }),
};
