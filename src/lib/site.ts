// The public address of the site, without a trailing slash. Used for absolute
// URLs: canonical links, the sitemap, Open Graph images, e-mails.
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
