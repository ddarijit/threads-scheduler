export default async function handler(req, res) {
    // 1. CORS Middleware
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        console.log('Received /exchange-token request');

        const { code, redirect_uri } = req.body || {};

        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const appId = process.env.VITE_THREADS_APP_ID;
        const appSecret = process.env.VITE_THREADS_APP_SECRET;

        if (!appId || !appSecret) {
            console.error('Missing Threads App configuration');
            return res.status(500).json({ error: 'Server configuration error: Missing App ID or Secret' });
        }

        const params = new URLSearchParams();
        params.append('client_id', appId);
        params.append('client_secret', appSecret);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', redirect_uri);
        params.append('code', code);

        console.log('Exchanging code for token with Redirect URI:', redirect_uri);

        const response = await fetch('https://graph.threads.net/oauth/access_token', {
            method: 'POST',
            body: params,
        });

        const text = await response.text();
        console.log('Threads API Raw Response:', text);

        let data;
        try {
            // Handle BigInt loss (Threads User IDs are huge)
            const safeText = text.replace(/"user_id":\s*(\d+)/g, '"user_id": "$1"');
            data = JSON.parse(safeText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            data = JSON.parse(text); // Fallback
        }

        // 1. Get Short-Lived Token
        if (data.error) {
            console.error('Threads API Error (Short-Lived):', data.error);
            return res.status(400).json({ error: data.error });
        }

        const shortLivedToken = data.access_token;
        const threadsUserId = String(data.user_id);

        console.log('Got short-lived token. Exchanging for long-lived token...');

        // 2. Exchange for Long-Lived Token
        const exchangeUrl = new URL('https://graph.threads.net/access_token');
        exchangeUrl.searchParams.append('grant_type', 'th_exchange_token');
        exchangeUrl.searchParams.append('client_secret', appSecret);
        exchangeUrl.searchParams.append('access_token', shortLivedToken);

        const exchangeResponse = await fetch(exchangeUrl.toString(), { method: 'GET' });
        const exchangeText = await exchangeResponse.text();
        const exchangeData = JSON.parse(exchangeText);

        if (exchangeData.error) {
            console.error('Threads API Error (Long-Lived):', exchangeData.error);
            // Fallback: Return short-lived token if exchange fails, but log it loudly
            console.warn('Falling back to short-lived token.');
            return res.status(200).json({
                access_token: shortLivedToken,
                user_id: threadsUserId
            });
        }

        console.log('Successfully obtained long-lived token!');

        // Return clean data (Long-Lived)
        return res.status(200).json({
            access_token: exchangeData.access_token,
            user_id: threadsUserId
        });

    } catch (err) {
        console.error('Exchange Token Error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}
