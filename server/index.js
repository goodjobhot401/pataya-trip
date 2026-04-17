require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3003;

// 初始化 Supabase (使用 Service Role Key 以擁有上傳權限)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

/**
 * 爬取網頁資訊並上傳至 Supabase Storage
 */
app.post('/api/crawl', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    try {
        console.log(`Crawling & Uploading: ${url}`);
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(html);
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '未命名地點';

        // 抓取候選圖片
        let candidateImages = [];
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) candidateImages.push(ogImage);

        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http') && candidateImages.length < 5) {
                if (!src.includes('icon') && !src.includes('logo') && !candidateImages.includes(src)) {
                    candidateImages.push(src);
                }
            }
        });

        // 3. 下載並上傳至 Supabase Storage
        const finalImageUrls = [];
        for (const imgUrl of candidateImages) {
            try {
                // 下載圖片為 Buffer
                const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data, 'binary');
                const contentType = response.headers['content-type'] || 'image/jpeg';

                // 產生唯一檔名
                const ext = contentType.split('/')[1] || 'jpg';
                const fileName = `${uuidv4()}.${ext}`;

                // 上傳到 Supabase Storage (Bucket 名稱為 recommendations)
                const { data, error } = await supabase.storage
                    .from('recommendations')
                    .upload(fileName, buffer, {
                        contentType: contentType,
                        upsert: true
                    });

                if (error) throw error;

                // 取得公開 URL
                const { data: { publicUrl } } = supabase.storage
                    .from('recommendations')
                    .getPublicUrl(fileName);

                finalImageUrls.push(publicUrl);
            } catch (err) {
                console.error(`Failed to process image: ${imgUrl}`, err.message);
            }
        }

        res.json({
            title: title.trim(),
            image_urls: finalImageUrls
        });

    } catch (error) {
        console.error('Crawl & Upload error:', error.message);
        res.status(500).json({ message: '無法處理該網站內容', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Crawler (Supabase Mode) running at http://localhost:${PORT}`);
});
