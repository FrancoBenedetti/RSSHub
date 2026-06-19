import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const BASE_URL = 'https://www.artikels.afriforum.co.za';

export const route: Route = {
    path: '/:category?',
    categories: ['traditional-media'],
    example: '/afriforum/mediaverklarings',
    parameters: {
        category: {
            description: 'Category slug. Leave empty for all latest posts.',
            options: [
                { value: 'mediaverklarings', label: 'Mediaverklarings' },
                { value: 'forum-nuus', label: 'Forum Nuus' },
                { value: 'artikels', label: 'Artikels' },
                { value: 'blogs', label: 'Blogs' },
                { value: 'meningstukke', label: 'Meningstukke' },
                { value: 'veiligheid-mediaverklarings', label: 'Veiligheid Mediaverklarings' },
                { value: 'gemeenskapsake-mediaverklarings', label: 'Gemeenskapsake Mediaverklarings' },
                { value: 'buurtwag-mediaverklarings', label: 'Buurtwag Mediaverklarings' },
                { value: 'erfenis-en-kultuur-mediaverklarings', label: 'Erfenis- en kultuurmediaverklarings' },
                { value: 'korrupsie-mediaverklarings', label: 'Korrupsie Mediaverklarings' },
                { value: 'lede-inhoud', label: 'Lede Inhoud' },
                { value: 'onssalself', label: '#OnsSalSelf' },
            ],
        },
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['artikels.afriforum.co.za/category/:category/'],
            target: '/:category',
        },
        {
            source: ['artikels.afriforum.co.za/'],
            target: '/',
        },
    ],
    name: 'Nuus / Kategorie Feed',
    maintainers: ['FrancoBenedetti'],
    handler: async (ctx) => {
        const category = ctx.req.param('category');

        // Resolve category slug to ID when a category is specified
        let categoryId: number | undefined;
        if (category) {
            const categoryData: Array<{ id: number; slug: string }> = await ofetch(`${BASE_URL}/wp-json/wp/v2/categories`, {
                query: {
                    slug: category,
                    per_page: 1,
                },
            });
            categoryId = categoryData[0]?.id;
        }

        // Build query params for the posts endpoint
        const query: Record<string, string | number> = {
            per_page: 20,
            _embed: 1,
            orderby: 'date',
            order: 'desc',
        };
        if (categoryId) {
            query.categories = categoryId;
        }

        const posts: any[] = await ofetch(`${BASE_URL}/wp-json/wp/v2/posts`, { query });

        const feedTitle = category ? `AfriForum – ${category}` : 'AfriForum';
        const feedLink = category ? `${BASE_URL}/category/${category}/` : BASE_URL;

        const items = posts.map((post) => {
            // Full rendered content from the REST API (no extra HTTP request needed)
            let description: string = post.content?.rendered ?? '';

            // Extract featured image from the embedded media data
            let imageUrl: string | undefined;

            // The theme injects `featured_image_src_large` as [url, width, height, cropped]
            if (Array.isArray(post.featured_image_src_large) && post.featured_image_src_large[0]) {
                imageUrl = post.featured_image_src_large[0];
            }

            // Fallback: dig into the embedded wp:featuredmedia object
            if (!imageUrl) {
                const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
                imageUrl = featuredMedia?.source_url ?? featuredMedia?.media_details?.sizes?.large?.source_url;
            }

            // Prepend the featured image before the article body so readers display it as a thumbnail
            if (imageUrl && !description.includes(imageUrl)) {
                description = `<img src="${imageUrl}" alt="${post.title?.rendered ?? ''}">\n${description}`;
            }

            // Category names
            const categoryNames: string[] = (post.category_info ?? []).map((c: { name: string }) => c.name);

            // Author display name
            const authorName: string = post.author_info?.display_name ?? post._embedded?.author?.[0]?.name ?? 'AfriForum';

            return {
                title: post.title?.rendered ?? '',
                link: post.link,
                description,
                pubDate: parseDate(post.date_gmt ?? post.date),
                author: authorName,
                category: categoryNames,
                guid: post.guid?.rendered ?? post.link,
                image: imageUrl,
                // Provide media:content for feed readers that support it (e.g. xentara)
                media: imageUrl
                    ? {
                          content: {
                              url: imageUrl,
                              medium: 'image',
                          },
                      }
                    : undefined,
            };
        });

        return {
            title: feedTitle,
            link: feedLink,
            description: 'AfriForum – Afrikaanse burger- en regtehoeorganisasie',
            language: 'af',
            image: 'https://www.artikels.afriforum.co.za/wp-content/uploads/2022/01/cropped-AfriforumLogo-landscape@0.5x-1.png',
            item: items,
        };
    },
};
